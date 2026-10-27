import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import SearchBar from "../../components/SearchBar";
import Modal from "../../components/Modal";
import Page from "../../components/Page";
export default function Internships() {
  const [jobs, setJobs] = useState([]),
    [q, setQ] = useState(""),
    [course, setCourse] = useState(""),
    [type, setType] = useState(""),
    [selected, setSelected] = useState(null),
    [letter, setLetter] = useState(""),
    [file, setFile] = useState(null),
    [msg, setMsg] = useState("");
  const nav = useNavigate();
  const load = () =>
    api
      .get("/jobs", { params: { search: q, course, type } })
      .then((r) => setJobs(r.data));
  useEffect(() => {
    void load();
  }, []);
  const apply = async () => {
    const fd = new FormData();
    fd.append("jobId", selected.id);
    fd.append("coverLetter", letter);
    if (file) fd.append("resume", file);
    try {
      const r = await api.post("/applications", fd);
      setMsg(r.data.message);
      setSelected(null);
    } catch (e) {
      setMsg(e.response?.data?.message || "Application failed.");
    }
  };
  return (
    <Page
      eyebrow="Student Portal"
      title="Find an Internship"
      description="Search and apply to published opportunities."
    >
      <div className="filters">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Search title, company..."
        />
        <select value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">All courses</option>
          <option>Computer Science</option>
          <option>Information Technology</option>
          <option>Information Systems</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option>Internship</option>
          <option>OJT</option>
          <option>Part-time</option>
        </select>
        <button className="btn btn-primary" onClick={load}>
          Search
        </button>
      </div>
      {msg && <div className="success">{msg}</div>}
      <div className="job-grid">
        {jobs.map((j) => (
          <article className="job-card" key={j.id}>
            <span className="tag">{j.type}</span>
            <h3>{j.title}</h3>
            <b>{j.company_name}</b>
            <p>{j.description}</p>
            <div className="job-meta">
              <span>⌖ {j.location}</span>
              <span>▣ {j.course}</span>
              <span>◷ {j.slots} slots</span>
            </div>
            <div className="card-actions">
              <button
                className="btn btn-light"
                onClick={() => nav(`/student/internships/${j.id}`)}
              >
                View Details
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setSelected(j)}
              >
                Apply
              </button>
            </div>
          </article>
        ))}
      </div>
      <Modal
        open={!!selected}
        title={`Apply: ${selected?.title}`}
        onClose={() => setSelected(null)}
      >
        <label>
          Cover Letter
          <textarea
            rows="5"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
          />
        </label>
        <label>
          Résumé
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>
        <div className="modal-actions">
          <button className="btn btn-light" onClick={() => setSelected(null)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={apply}>
            Submit Application
          </button>
        </div>
      </Modal>
    </Page>
  );
}
