import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname.startsWith(path);

  const token = localStorage.getItem("token");

  let firstName = "";

  if (token) {
    try {
      const decoded = JSON.parse(
        atob(token.split(".")[1])
      );
      firstName = decoded.firstName;
    } catch {
      firstName = "";
    }
  }

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/dashboard" className="logo">
          🚀 DeployHub
        </Link>

        <Link
          to="/dashboard"
          className={isActive("/dashboard") ? "active" : ""}
        >
          Dashboard
        </Link>
        
      </div>

      <div className="nav-right">
        {firstName && (
          <span className="user-name">
            Hi, {firstName}
          </span>
        )}

        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
}
