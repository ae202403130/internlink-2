import { useEffect, useState } from "react";
import api from "../../api";
import Page from "../../components/Page";
export default function Applications() {
  const [r, setR] = useState([]);
  useEffect(() => {
    void api.get("/student/applications").then((x) => setR(x.data));
  }, []);
  return (
    <Page
      eyebrow="Student Portal"
      title="My Applications"
      description="Track every submitted application."
    >
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Company</th>
              <th>Type</th>
              <th>Applied</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr key={x.id}>
                <td>
                  <b>{x.title}</b>
                  <small>{x.location}</small>
                </td>
                <td>{x.company_name}</td>
                <td>{x.type}</td>
                <td>{new Date(x.applied_at).toLocaleDateString()}</td>
                <td>
                  <span className={`status ${x.status}`}>{x.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!r.length && <p className="muted">No applications yet.</p>}
      </div>
    </Page>
  );
}
