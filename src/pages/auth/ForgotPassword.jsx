import { useState } from "react";
import { Link } from "react-router-dom";
export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark big">W</div>
        <h2>Forgot Password</h2>
        <p className="muted">
          Recovery is simulated in this classroom prototype.
        </p>
        {sent ? (
          <div className="success">
            Recovery request received. In a real deployment, an email would be
            sent.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <label>
              WMSU Email
              <input required type="email" />
            </label>
            <button className="btn btn-primary full">
              Send Recovery Request
            </button>
          </form>
        )}
        <p className="center">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
