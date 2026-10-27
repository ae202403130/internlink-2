import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import Page from "../../components/Page";
export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    void api.get("/employer/dashboard").then((r) => setD(r.data));
  }, []);
  if (!d) return <div className="page">Loading...</div>;
  return (
    <Page
      eyebrow="Employer Portal"
      title={`Welcome, ${d.employer.company_name}`}
      description="Manage recruitment activity."
      action={
        <Link className="btn btn-primary" to="/employer/jobs">
          Create Posting
        </Link>
      }
    >
      <div className="stats">
        <div>
          <span>Total Postings</span>
          <b>{d.stats.postings || 0}</b>
        </div>
        <div>
          <span>Published</span>
          <b>{d.stats.published || 0}</b>
        </div>
        <div>
          <span>Applicants</span>
          <b>{d.stats.applications || 0}</b>
        </div>
        <div>
          <span>Approval</span>
          <b>{d.employer.approval_status}</b>
        </div>
      </div>
      <div className="panel">
        <h2>Recruitment workflow</h2>
        <p className="muted">
          Create a posting → admin review → publication → student applications →
          applicant review.
        </p>
      </div>
    </Page>
  );
}
