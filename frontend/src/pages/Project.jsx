import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import API from "../api";

export default function Project() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get(`/project/${id}`);
      setProject(data.project);
    } catch (err) {
      console.error(err);
      alert("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [id, fetchProject]);

  const deploy = async () => {
    try {
      setDeploying(true);

      await API.post("/deploy", {
        projectid: id,
      });

      alert("🚀 Deployment started!");
      fetchProject(); // refresh after deploy
    } catch (err) {
      alert(err.response?.data?.error || "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h3>Loading project...</h3>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 40 }}>
        <h3>Project not found</h3>
      </div>
    );
  }

  const liveUrl = `http://${project.subdomain}.localhost:8000`;

  return (
    <div
      style={{
        padding: 40,
        minHeight: "100vh",
        background: "#0f172a",
        color: "#fff",
      }}
    >
      {/* Project Header */}
      <div
        style={{
          background: "#1e293b",
          padding: 25,
          borderRadius: 12,
          marginBottom: 30,
          boxShadow: "0 6px 15px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ marginBottom: 10 }}>{project.name}</h2>

        <p><strong>Project ID:</strong> {project.id}</p>
        <p><strong>Subdomain:</strong> {project.subdomain}</p>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={deploy}
            disabled={deploying}
            style={{
              padding: "10px 18px",
              marginRight: 15,
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>

          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              background: "green",
              color: "#fff",
              padding: "10px 18px",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "bold",
            }}
          >
            🚀 Live Site
          </a>
        </div>
      </div>

      {/* Deployment History */}
      <h3 style={{ marginBottom: 20 }}>Deployment History</h3>

      {!project.deployments || project.deployments.length === 0 ? (
        <p>No deployments yet.</p>
      ) : (
        project.deployments.map((dep) => (
          <div
            key={dep.id}
            style={{
              background: "#1e293b",
              padding: 15,
              borderRadius: 8,
              marginBottom: 15,
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            }}
          >
            <p><strong>ID:</strong> {dep.id}</p>
            <p>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  color:
                    dep.status === "READY"
                      ? "limegreen"
                      : dep.status === "QUEUE"
                      ? "orange"
                      : "red",
                }}
              >
                {dep.status}
              </span>
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(dep.createdAt).toLocaleString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
