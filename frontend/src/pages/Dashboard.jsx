import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ name: "", gitUrl: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await API.get("/projects");
      setProjects(data.projects);
    } catch {
      alert("Failed to load projects");
    }
  };

  const createProject = async () => {
    if (form.name.length < 5) {
      return alert("Project name must be at least 5 characters");
    }

    try {
      setLoading(true);

      const { data } = await API.post("/project", form);

      navigate(`/project/${data.project.id}`);
    } catch (err) {
      alert(
        err.response?.data?.error?.[0]?.message ||
          err.response?.data?.error ||
          "Project creation failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Create Project</h2>

      <input
        placeholder="Project Name"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <br />
      <br />

      <input
        placeholder="Git Repo URL"
        onChange={(e) => setForm({ ...form, gitUrl: e.target.value })}
      />

      <br />
      <br />

      <button onClick={createProject} disabled={loading}>
        {loading ? "Creating..." : "Create Project"}
      </button>

      <hr style={{ margin: "40px 0" }} />

      <h2>Your Projects</h2>

      {projects.length === 0 && <p>No projects yet.</p>}

      {projects.map((project) => {
        const latestDeployment = project.deployments?.[0];

        const liveUrl = `http://${project.subdomain}.localhost:8000`;

        return (
          <div
            key={project.id}
            style={{
              border: "1px solid #ddd",
              padding: 20,
              marginBottom: 15,
              borderRadius: 8,
              background: "#f9f9f9",
            }}
          >
            <h3>{project.name}</h3>

            <p>
              <strong>Project ID:</strong> {project.id}
            </p>

            <p>
              <strong>Subdomain:</strong> {project.subdomain}
            </p>

            {latestDeployment && (
              <p>
                <strong>Last Deployment:</strong> {latestDeployment.id}
              </p>
            )}

            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => navigate(`/project/${project.id}`)}
                style={{
                  marginRight: 10,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                View Project
              </button>

              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "green",
                  color: "#fff",
                  padding: "6px 12px",
                  textDecoration: "none",
                  borderRadius: 4,
                }}
              >
                🚀 Live Site
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
