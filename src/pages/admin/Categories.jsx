import { useEffect, useState } from "react";
import api from "../../api";
import Page from "../../components/Page";
export default function Categories() {
  const [r, setR] = useState([]),
    [name, setName] = useState(""),
    [desc, setDesc] = useState("");
  const load = () => api.get("/admin/categories").then((x) => setR(x.data));
  useEffect(() => {
    void load();
  }, []);
  const add = async (e) => {
    e.preventDefault();
    if (name) {
      await api.post("/admin/categories", { name, description: desc });
      setName("");
      setDesc("");
      load();
    }
  };
  const del = async (id) => {
    if (confirm("Delete category?")) {
      await api.delete(`/admin/categories/${id}`);
      load();
    }
  };
  return (
    <Page eyebrow="Administration" title="Categories & Courses">
      <div className="grid-2">
        <form className="panel form-grid" onSubmit={add}>
          <h2>Add Category</h2>
          <label>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Description
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <button className="btn btn-primary">Add Category</button>
        </form>
        <div className="panel">
          <h2>Categories</h2>
          {r.map((x) => (
            <div className="list-row" key={x.id}>
              <div>
                <b>{x.name}</b>
                <span>{x.description}</span>
              </div>
              <button className="link-btn danger" onClick={() => del(x.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
