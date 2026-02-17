import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/Dashboard";
import Project from "./pages/Project";
import Navbar from "./components/navbar";

function PrivateRoute({ children }) {
  return localStorage.getItem("token")
    ? children
    : <Navigate to="/" />;
}

function ProtectedLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/project/:id"
        element={
          <PrivateRoute>
            <ProtectedLayout>
              <Project />
            </ProtectedLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
