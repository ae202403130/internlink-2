import { useEffect, useState } from "react";
import api from "../../api";
import Page from "../../components/Page";
export default function Applicants() {
  const [r, setR] = useState([]),
    [msg, setMsg] = useState("");
  const load = () => api.get("/employer/applicants").then((x) => setR(x.data));
  useEffect(() => {
    void load();
  }, []);
  const update = async (id, status) => {
    const x = await api.put(`/employer/applications/${id}/status`, { status });
    setMsg(x.data.message);
    load();
  };
  return (
    <Page
      eyebrow="Employer Portal"
      title="Applicants"
      description="Review candidates and update statuses."
    >
      {msg && <div className="success">{msg}</div>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Position</th>
              <th>Course</th>
              <th>Skills</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr key={x.id}>
                <td>
                  <b>
                    {x.first_name} {x.last_name}
                  </b>
                  <small>{x.email}</small>
                </td>
                <td>{x.title}</td>
                <td>{x.course}</td>
                <td>{x.skills}</td>
                <td>
                  <select
                    value={x.status}
                    onChange={(e) => update(x.id, e.target.value)}
                  >
                    <option>submitted</option>
                    <option>reviewing</option>
                    <option>shortlisted</option>
                    <option>accepted</option>
                    <option>rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
