import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
export default function Register() {
  const [role, setRole] = useState("student"),
    [f, setF] = useState({}),
    [msg, setMsg] = useState("");
  const nav = useNavigate();
  const set = (k, v) => setF({ ...f, [k]: v });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post("/auth/register", {
        role,
        email: f.email,
        password: f.password,
        firstName: f.firstName,
        lastName: f.lastName,
        course: f.course,
        yearLevel: f.yearLevel,
        companyName: f.companyName,
      });
      setMsg(r.data.message);
      setTimeout(() => nav("/login"), 800);
    } catch (e) {
      setMsg(e.response?.data?.message || "Registration failed.");
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="auth-brand">
          <div className="brand-mark big">W</div>
          <div>
            <h1>Create an account</h1>
            <p>Join WMSU InternLink</p>
          </div>
        </div>
        {msg && <div className="alert">{msg}</div>}
        <form onSubmit={submit}>
          <label>
            Account Type
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="employer">Employer</option>
            </select>
          </label>
          <div className="two">
            <label>
              First Name
              <input
                required
                onChange={(e) => set("firstName", e.target.value)}
              />
            </label>
            <label>
              Last Name
              <input
                required
                onChange={(e) => set("lastName", e.target.value)}
              />
            </label>
          </div>
          <label>
            Email
            <input
              required
              type="email"
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          {role === "student" ? (
            <div className="two">
              <label>
                Course
                <input
                  required
                  onChange={(e) => set("course", e.target.value)}
                />
              </label>
              <label>
                Year Level
                <input
                  required
                  onChange={(e) => set("yearLevel", e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label>
              Company Name
              <input
                required
                onChange={(e) => set("companyName", e.target.value)}
              />
            </label>
          )}
          <label>
            Password
            <input
              required
              minLength="6"
              type="password"
              onChange={(e) => set("password", e.target.value)}
            />
          </label>
          <button className="btn btn-primary full">Register</button>
        </form>
        <p className="center">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
