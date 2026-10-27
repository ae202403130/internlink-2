import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import Page from "../../components/Page";
export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    void api.get("/admin/stats").then((r) => setD(r.data));
  }, []);
  if (!d) return <div className="page">Loading...</div>;
  return (
    <Page
      eyebrow="Administrator"
      title="System Dashboard"
      description="Monitor the whole InternLink system."
      action={
        <Link className="btn btn-primary" to="/admin/reports">
          Reports
        </Link>
      }
    >
      <div className="stats">
        <div>
          <span>Total Users</span>
          <b>{d.users.total}</b>
        </div>
        <div>
          <span>Students</span>
          <b>{d.users.students || 0}</b>
        </div>
        <div>
          <span>Employers</span>
          <b>{d.users.employers || 0}</b>
        </div>
        <div>
          <span>Applications</span>
          <b>{d.applications.total}</b>
        </div>
        <div>
          <span>Pending Jobs</span>
          <b>{d.jobs.pending || 0}</b>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <h2>Job Moderation</h2>
          <p>{d.jobs.pending || 0} posting(s) awaiting review.</p>
          <Link to="/admin/jobs">Review →</Link>
        </div>
        <div className="panel">
          <h2>Employer Verification</h2>
          <p>Review and approve employer registrations.</p>
          <Link to="/admin/employers">Manage →</Link>
        </div>
      </div>
    </Page>
  );
}
