import { useEffect, useState } from "react";
import api from "../../api";
import Page from "../../components/Page";
export default function CompanyProfile() {
  const [f, setF] = useState(null),
    [msg, setMsg] = useState("");
  useEffect(() => {
    void api.get("/employer/profile").then((r) => setF(r.data));
  }, []);
  if (!f) return <div className="page">Loading...</div>;
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async (e) => {
    e.preventDefault();
    const r = await api.put("/employer/profile", {
      companyName: f.company_name,
      description: f.description,
      location: f.location,
      website: f.website,
    });
    setMsg(r.data.message);
  };
  return (
    <Page eyebrow="Employer Portal" title="Company Profile">
      {msg && <div className="success">{msg}</div>}
      <form className="panel form-grid" onSubmit={save}>
        <label>
          Company Name
          <input
            value={f.company_name}
            onChange={(e) => set("company_name", e.target.value)}
          />
        </label>
        <label>
          Email
          <input disabled value={f.email} />
        </label>
        <label>
          Description
          <textarea
            rows="5"
            value={f.description || ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <div className="two">
          <label>
            Location
            <input
              value={f.location || ""}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
          <label>
            Website
            <input
              value={f.website || ""}
              onChange={(e) => set("website", e.target.value)}
            />
          </label>
        </div>
        <button className="btn btn-primary">Save Changes</button>
      </form>
    </Page>
  );
}
