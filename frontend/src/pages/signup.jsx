import { useState } from "react";
import axios from "axios";

function Signup({ setPage }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      const res = await axios.post("http://localhost:9000/register", {
        firstName,
        lastName,
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      alert("Signup Successful");
      setPage("login");
    } catch (err) {
      alert(err.response?.data?.error || "Signup Failed");
    }
  };

  return (
    <div className="container">
      <h2>Sign Up</h2>

      <input
        type="text"
        placeholder="First Name"
        onChange={(e) => setFirstName(e.target.value)}
      />

      <input
        type="text"
        placeholder="Last Name"
        onChange={(e) => setLastName(e.target.value)}
      />

      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleSignup}>Sign Up</button>

      <div className="link">
        Already have an account?{" "}
        <span onClick={() => setPage("login")}>Login</span>
      </div>
    </div>
  );
}

export default Signup;
