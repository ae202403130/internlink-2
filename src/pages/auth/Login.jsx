import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
export default function Login() {
  const [role, setRole] = useState("student"),
    [email, setEmail] = useState("student@wmsu.edu.ph"),
    [password, setPassword] = useState("student123"),
    [msg, setMsg] = useState("");
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post("/auth/login", { email, password, role });
      localStorage.setItem("internlink_token", r.data.token);
      localStorage.setItem("internlink_user", JSON.stringify(r.data.user));
      nav(`/${role}`);
    } catch (e) {
      setMsg(e.response?.data?.message || "Login failed.");
    }
  };
  const demo = (r) => {
    setRole(r);
    setEmail(
      r === "student"
        ? "student@wmsu.edu.ph"
        : r === "employer"
          ? "employer@wmsu.edu.ph"
          : "admin@wmsu.edu.ph",
    );
    setPassword(
      r === "student"
        ? "student123"
        : r === "employer"
          ? "employer123"
          : "admin123",
    );
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark big">W</div>
          <div>
            <h1>WMSU InternLink</h1>
            <p>Career & Internship Portal</p>
          </div>
        </div>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to your portal.</p>
        {msg && <div className="alert">{msg}</div>}
        <form onSubmit={submit}>
          <label>
            Portal Role
            <select value={role} onChange={(e) => demo(e.target.value)}>
              <option value="student">Student</option>
              <option value="employer">Employer</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label>
            WMSU Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary full">Sign In</button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create account</Link>
        </div>
        <p className="demo-note">Demo credentials are prefilled for testing.</p>
      </div>
    </div>
  );
}
