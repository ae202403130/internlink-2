import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import SD from "./pages/student/Dashboard";
import SP from "./pages/student/Profile";
import SI from "./pages/student/Internships";
import SJ from "./pages/student/JobDetails";
import SA from "./pages/student/Applications";
import SN from "./pages/student/Notifications";
import ED from "./pages/employer/Dashboard";
import EP from "./pages/employer/CompanyProfile";
import EJ from "./pages/employer/JobPostings";
import EA from "./pages/employer/Applicants";
import EN from "./pages/employer/Notifications";
import AD from "./pages/admin/Dashboard";
import AU from "./pages/admin/Users";
import AE from "./pages/admin/Employers";
import AJ from "./pages/admin/JobApprovals";
import AA from "./pages/admin/Applications";
import AC from "./pages/admin/Categories";
import AN from "./pages/admin/Announcements";
import AR from "./pages/admin/Reports";

function Guard({ role, children }) {
  const u = JSON.parse(localStorage.getItem("internlink_user") || "null");

  if (!u) return <Navigate to="/login" />;
  if (role && u.role !== role) return <Navigate to={`/${u.role}`} />;

  return children;
}

function Portal({ kind, children }) {
  const u = JSON.parse(localStorage.getItem("internlink_user") || "null");
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <Navbar user={u} onMenu={() => setOpen(!open)} />
      <Sidebar role={kind} open={open} />
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/student"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SD />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/student/profile"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SP />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/student/internships"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SI />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/student/internships/:id"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SJ />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/student/applications"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SA />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/student/notifications"
        element={
          <Guard role="student">
            <Portal kind="student">
              <SN />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/employer"
        element={
          <Guard role="employer">
            <Portal kind="employer">
              <ED />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/employer/profile"
        element={
          <Guard role="employer">
            <Portal kind="employer">
              <EP />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/employer/jobs"
        element={
          <Guard role="employer">
            <Portal kind="employer">
              <EJ />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/employer/applicants"
        element={
          <Guard role="employer">
            <Portal kind="employer">
              <EA />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/employer/notifications"
        element={
          <Guard role="employer">
            <Portal kind="employer">
              <EN />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AD />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AU />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/employers"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AE />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/jobs"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AJ />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AA />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AC />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/announcements"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AN />
            </Portal>
          </Guard>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <Guard role="admin">
            <Portal kind="admin">
              <AR />
            </Portal>
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
