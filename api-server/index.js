require("dotenv").config({ path: "../.env" });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { generateSlug } = require("random-word-slugs");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@clickhouse/client");
const { Kafka } = require("kafkajs");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.API_PORT || 9000;

app.use(express.json());
app.use(cors());

// prisma client
const prisma = new PrismaClient();

// kafka client
const kafka = new Kafka({
  clientId: "api-server",
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "ca.pem"), "utf-8")],
  },
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  retry: {
    initialRetryTime: 300,
    retries: 20,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

// kafka consumer
const consumer = kafka.consumer({ groupId: "api-server-logs-consumer" });

// clickhouse client
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
});

// socket server
const io = new Server({ cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", JSON.stringify({ log: `Subscribed to ${channel}` }));
  });
});

io.listen(9002, () => console.log("Socket server running on port 9002"));

// ECS client
const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ecsConfig = {
  cluster: process.env.ECS_CLUSTER_ARN,
  task: process.env.ECS_TASK_DEFINITION,
};

// auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// get projects for user
app.get("/projects", authMiddleware, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// get specific project by id
app.get("/project/:id", authMiddleware, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: "Failed to load project" });
  }
});


// register route
app.post("/register", async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  const { firstName, lastName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
    },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, firstName: user.firstName },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({ token });
});

// login route
app.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, email: user.email, firstName: user.firstName },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({ token });
});

// project route 
app.post("/project", authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(5),
    gitUrl: z.string().url(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  const { name, gitUrl } = parsed.data;

  const project = await prisma.project.create({
    data: {
      name,
      gitUrl,
      subdomain: generateSlug(),
      userId: req.user.id,
    },
  });

  res.json({ project });
});

// deploy route
app.post("/deploy", authMiddleware, async (req, res) => {
  const { projectid } = req.body;

  const project = await prisma.project.findUnique({
    where: { id: projectid },
  });

  if (!project || project.userId !== req.user.id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const deployment = await prisma.deployment.create({
    data: {
      project: { connect: { id: projectid } },
      status: "QUEUE",
    },
  });

  const command = new RunTaskCommand({
    cluster: ecsConfig.cluster,
    taskDefinition: ecsConfig.task,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [
          process.env.ECS_SUBNET_1,
          process.env.ECS_SUBNET_2,
          process.env.ECS_SUBNET_3,
        ],
        assignPublicIp: "ENABLED",
        securityGroups: [process.env.ECS_SECURITY_GROUP],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "build-img",
          environment: [
            { name: "GIT_REPO_URL", value: project.gitUrl },
            { name: "PROJECT_ID", value: project.subdomain },
            { name: "DEPLOYMENT_ID", value: deployment.id },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  res.json({
    deploymentId: deployment.id,
    subdomain: project.subdomain,
    liveUrl: `http://${project.subdomain}.localhost:8000`,
  });
});

// logs route to fetch logs for a deployment
app.get("/logs/:id", async (req, res) => {
  try {
    const logs = await prisma.logEvent.findMany({
      where: {
        deploymentId: req.params.id, // must match UUID
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json({ logs });
  } catch (err) {
    console.error("❌ Failed to fetch logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// kafka consumer to read logs and insert into DB
async function initKafkaConsumer() {
  await consumer.connect();
  console.log("✅ Kafka consumer connected");

  await consumer.subscribe({
    topics: ["container-logs"],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      try {
        const parsed = JSON.parse(message.value.toString());
        const { DEPLOYMENT_ID, log } = parsed;

        if (!DEPLOYMENT_ID || !log) return;

        const sanitizedLog = log.trim().replace(/[\u0000-\u001F]/g, "");

        // ✅ ONLY THIS FIX
        await prisma.logEvent.create({
          data: {
            deploymentId: DEPLOYMENT_ID,
            log: sanitizedLog,
            metadata: {},
          },
        });

        console.log("✅ Log inserted:", DEPLOYMENT_ID);
      } catch (err) {
        console.error("❌ Insert failed:", err);
      }
    },
  });

  console.log("🟢 Kafka consumer running...");
}

initKafkaConsumer().catch((err) => {
  console.error("❌ Kafka consumer failed to start:", err);
  process.exit(1);
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});
