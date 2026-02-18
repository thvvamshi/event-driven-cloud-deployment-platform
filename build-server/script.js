require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { execSync, exec } = require("child_process");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const { Kafka, Partitioners } = require("kafkajs");

// ENV
const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const GIT_REPO_URL = process.env.GIT_REPO_URL;

if (!PROJECT_ID || !DEPLOYMENT_ID || !GIT_REPO_URL) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// VALIDATE GIT REPO URL
const allowedRepo = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/;
if (!allowedRepo.test(GIT_REPO_URL)) {
  console.error("Invalid GitHub repository URL");
  process.exit(1);
}

// S3 CLIENT
const s3client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// KAFKA CLIENT
const kafka = new Kafka({
  clientId: `build-server-${DEPLOYMENT_ID}`,
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "ca.pem"), "utf-8")],
    rejectUnauthorized: true,
  },
  sasl: {
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    mechanism: "plain",
  },
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

// SEND LOG TO KAFKA
async function publishLog(log) {
  console.log("📤 Publishing:", log);

  await producer.send({
    topic: "container-logs",
    messages: [
      {
        key: DEPLOYMENT_ID,
        value: JSON.stringify({
          PROJECT_ID,
          DEPLOYMENT_ID,
          log,
          timestamp: new Date().toISOString(),
        }),
      },
    ],
  });
}

// FIND PACKAGE.JSON
function findProjectRoot(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isFile() && item.name === "package.json") {
      return dir;
    }

    if (item.isDirectory()) {
      const result = findProjectRoot(fullPath);
      if (result) return result;
    }
  }

  return null;
}

// UPLOAD FOLDER TO S3
async function uploadFolder(folderPath) {
  const files = fs.readdirSync(folderPath, { recursive: true });

  for (const file of files) {
    const filePath = path.join(folderPath, file);

    if (fs.lstatSync(filePath).isDirectory()) continue;

    await publishLog(`Uploading ${file}`);

    const command = new PutObjectCommand({
      Bucket: "vercel-deployment-services",
      Key: `__output/${PROJECT_ID}/${file.replace(/\\/g, "/")}`,
      Body: fs.createReadStream(filePath),
      ContentType: mime.lookup(filePath) || "application/octet-stream",
    });

    await s3client.send(command);
    await publishLog(`Uploaded ${file}`);
  }
}

async function init() {
  try {
    await producer.connect();
    await publishLog("🚀 Build Started");

    const outputPath = path.join(__dirname, "output");

    // CLEAN OUTPUT FOLDER
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }

    // CLONE REPO
    try {
      execSync(`git clone ${GIT_REPO_URL} output`, { stdio: "inherit" });
      await publishLog("Repository cloned successfully");
    } catch (err) {
      await publishLog("❌ Repository clone failed (maybe private repo)");
      await producer.disconnect();
      process.exit(1);
    }

    const projectRoot = findProjectRoot(outputPath);

    // STATIC PROJECT (no package.json)
    if (!projectRoot) {
      const indexPath = path.join(outputPath, "index.html");

      if (!fs.existsSync(indexPath)) {
        await publishLog("No package.json or index.html found");
        await producer.disconnect();
        process.exit(1);
      }

      await publishLog("Static project detected");
      await uploadFolder(outputPath);

      await publishLog("✅ Deployment Completed");
      await producer.disconnect();
      process.exit(0);
    }

    await publishLog(`Project root detected at ${projectRoot}`);

    const buildProcess = exec("npm install && npm run build", {
      cwd: projectRoot,
    });

    buildProcess.stdout.on("data", async (data) => {
      await publishLog(data.toString());
    });

    buildProcess.stderr.on("data", async (data) => {
      await publishLog(`ERROR: ${data.toString()}`);
    });

    buildProcess.on("close", async (code) => {
      if (code !== 0) {
        await publishLog(`❌ Build failed with code ${code}`);
        await producer.disconnect();
        process.exit(1);
      }

      await publishLog("Build completed successfully");

      // 🔥 MULTI-FRAMEWORK OUTPUT SUPPORT
      const possibleOutputs = ["dist", "build", "out"];
      let outputFolder = null;

      for (const folder of possibleOutputs) {
        const fullPath = path.join(projectRoot, folder);
        if (fs.existsSync(fullPath)) {
          outputFolder = fullPath;
          break;
        }
      }

      // Angular case: dist/<project-name>/
      if (!outputFolder) {
        const distPath = path.join(projectRoot, "dist");
        if (fs.existsSync(distPath)) {
          const subFolders = fs.readdirSync(distPath, { withFileTypes: true });
          const folder = subFolders.find((f) => f.isDirectory());
          if (folder) {
            outputFolder = path.join(distPath, folder.name);
          }
        }
      }

      if (!outputFolder) {
        await publishLog("No valid build output folder found (dist/build/out)");
        await producer.disconnect();
        process.exit(1);
      }

      await publishLog(`Uploading from ${outputFolder}`);
      await uploadFolder(outputFolder);

      await publishLog("🎉 Deployment Successful");

      await producer.disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error("Fatal Error:", err);
    await producer.disconnect();
    process.exit(1);
  }
}

init();
