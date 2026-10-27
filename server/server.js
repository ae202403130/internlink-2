import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool, query, withTransaction, checkDatabase, describeDbError } from "./db.js"; // db.js also loads .env
import { auth, role, tokenFor, checkJwtSecret } from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({ origin: clientOrigins }));
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 } });

/* ------------------------------------------------------------------ helpers */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const httpError = (status, message) => new HttpError(status, message);

const JOB_TYPES = ["Internship", "OJT", "Part-time"];
const JOB_STATUSES = ["pending", "published", "closed", "rejected"];
const APPLICATION_STATUSES = ["submitted", "reviewing", "shortlisted", "accepted", "rejected"];
const USER_STATUSES = ["active", "inactive", "pending"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const AUDIENCES = ["all", "student", "employer"];

/** Express 5 leaves req.body undefined when no body was sent. */
const body = (req) => req.body ?? {};
/** Trimmed string, or "" for anything that is not a string. */
const text = (v) => (typeof v === "string" ? v.trim() : "");
/** null for missing values, otherwise the value as a string. */
const optional = (v) => (v === undefined || v === null ? null : String(v));
/** Positive 32-bit integer id, or null. */
const toId = (v) => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
};
/** Escape % and _ so user input is matched literally by LIKE/ILIKE. */
const likePattern = (s) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
/** "YYYY-MM-DD" (also accepts a full ISO timestamp) -> "YYYY-MM-DD", or null. */
function toDate(v) {
  const s = String(v ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

/** `db` may be the pool or a transaction client. */
const notify = (db, userId, title, message) =>
  db.query("INSERT INTO notifications(user_id, title, message) VALUES($1, $2, $3)", [userId, title, message]);

async function employerIdFor(db, userId) {
  const { rows } = await db.query("SELECT id FROM employers WHERE user_id = $1", [userId]);
  if (!rows.length) throw httpError(404, "Employer profile not found.");
  return rows[0].id;
}

function parseJob(b) {
  const title = text(b.title);
  const description = text(b.description);
  const location = text(b.location);
  const course = text(b.course);
  const type = text(b.type) || "Internship";
  const slots = b.slots === undefined || b.slots === null || b.slots === "" ? 1 : Number(b.slots);
  const deadline = toDate(b.deadline);
  if (!title || !description || !location || !course) {
    throw httpError(400, "Title, description, location and course are required.");
  }
  if (!JOB_TYPES.includes(type)) throw httpError(400, "Invalid job type.");
  if (!Number.isInteger(slots) || slots < 1 || slots > 100000) {
    throw httpError(400, "Slots must be a whole number of 1 or more.");
  }
  if (!deadline) throw httpError(400, "A valid deadline (YYYY-MM-DD) is required.");
  return { title, description, location, course, type, slots, deadline };
}

const discardUpload = (req) => {
  if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
};

// Every :id route parameter must be a sane integer, otherwise Postgres would
// throw "invalid input syntax for type integer" and the client would see a 500.
app.param("id", (req, res, next, id) =>
  toId(id) ? next() : res.status(400).json({ message: "Invalid id." })
);

/* ------------------------------------------------------------------- health */

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (e) {
    res.status(500).json({ ok: false, message: describeDbError(e) });
  }
});

/* --------------------------------------------------------------------- auth */

app.post("/api/auth/register", async (req, res) => {
  const b = body(req);
  const r = b.role;
  const email = text(b.email);
  const firstName = text(b.firstName);
  const lastName = text(b.lastName);
  if (
    !["student", "employer"].includes(r) ||
    !email ||
    typeof b.password !== "string" ||
    b.password.length < 6 ||
    !firstName ||
    !lastName
  ) {
    return res
      .status(400)
      .json({ message: "Complete all required fields. Password must be 6+ characters." });
  }

  const hash = await bcrypt.hash(b.password, 10);

  // One transaction: a failure in the profile insert must not leave an orphan
  // user row that blocks the email address forever. A duplicate email surfaces
  // as unique violation users_email_lower_key -> 409 (see errorHandler).
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO users(role, email, password_hash, first_name, last_name, status)
       VALUES($1, $2, $3, $4, $5, $6) RETURNING id`,
      [r, email, hash, firstName, lastName, r === "employer" ? "pending" : "active"]
    );
    const userId = rows[0].id;
    if (r === "student") {
      await db.query("INSERT INTO students(user_id, course, year_level) VALUES($1, $2, $3)", [
        userId,
        text(b.course),
        text(b.yearLevel),
      ]);
    } else {
      await db.query(
        "INSERT INTO employers(user_id, company_name, approval_status) VALUES($1, $2, 'pending')",
        [userId, text(b.companyName) || `${firstName} ${lastName}`]
      );
    }
  });
  res.status(201).json({ message: "Registration successful. You can now log in." });
});

app.post("/api/auth/login", async (req, res) => {
  const b = body(req);
  if (typeof b.email !== "string" || typeof b.password !== "string" || typeof b.role !== "string") {
    return res.status(400).json({ message: "Email, password and role are required." });
  }
  const { rows } = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role = $2", [
    b.email.trim(),
    b.role,
  ]);
  const invalid = () => res.status(401).json({ message: "Invalid email, password, or role." });
  if (!rows.length) return invalid();
  const u = rows[0];
  // Check the password before the status so account state is not revealed to
  // someone who does not know the password.
  if (!(await bcrypt.compare(b.password, u.password_hash))) return invalid();
  if (u.status !== "active") return res.status(403).json({ message: "Account is not active yet." });

  const user = { id: u.id, role: u.role, email: u.email, firstName: u.first_name, lastName: u.last_name };
  res.json({ token: tokenFor(u), user });
});

/* --------------------------------------------------------------- public jobs */

app.get("/api/jobs", async (req, res) => {
  const search = text(req.query.search);
  const course = text(req.query.course);
  const location = text(req.query.location);
  const type = text(req.query.type);

  const where = ["j.status = 'published'"];
  const params = [];
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  // MySQL's LIKE was case-insensitive; PostgreSQL's is not, so use ILIKE.
  if (search) {
    const p = bind(likePattern(search));
    where.push(`(j.title ILIKE ${p} OR e.company_name ILIKE ${p} OR j.description ILIKE ${p})`);
  }
  if (course) where.push(`j.course ILIKE ${bind(likePattern(course))}`);
  if (location) where.push(`j.location ILIKE ${bind(likePattern(location))}`);
  if (type) where.push(`j.type = ${bind(type)}`);

  const { rows } = await query(
    `SELECT j.*, e.company_name
       FROM jobs j JOIN employers e ON e.id = j.employer_id
      WHERE ${where.join(" AND ")}
      ORDER BY j.created_at DESC, j.id DESC`,
    params
  );
  res.json(rows);
});

app.get("/api/jobs/:id", async (req, res) => {
  const { rows } = await query(
    `SELECT j.*, e.company_name, e.description AS company_description
       FROM jobs j JOIN employers e ON e.id = j.employer_id
      WHERE j.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: "Job not found" });
  res.json(rows[0]);
});

/* ------------------------------------------------------------------ student */

const STUDENT_PROFILE_SQL = `
  SELECT s.*, u.first_name, u.last_name, u.email
    FROM students s JOIN users u ON u.id = s.user_id
   WHERE u.id = $1`;

app.get("/api/student/dashboard", auth, role("student"), async (req, res) => {
  const { rows } = await query(STUDENT_PROFILE_SQL, [req.user.id]);
  if (!rows.length) throw httpError(404, "Student profile not found.");
  const student = rows[0];

  const [stats, applications, notifications] = await Promise.all([
    query(
      `SELECT COUNT(*) AS applications,
              COUNT(*) FILTER (WHERE status = 'shortlisted') AS shortlisted,
              COUNT(*) FILTER (WHERE status = 'accepted')    AS accepted
         FROM applications WHERE student_id = $1`,
      [student.id]
    ),
    query(
      `SELECT a.*, j.title, e.company_name
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN employers e ON e.id = j.employer_id
        WHERE a.student_id = $1
        ORDER BY a.applied_at DESC, a.id DESC LIMIT 5`,
      [student.id]
    ),
    query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 5", [
      req.user.id,
    ]),
  ]);
  res.json({
    student,
    stats: stats.rows[0],
    applications: applications.rows,
    notifications: notifications.rows,
  });
});

app.get("/api/student/profile", auth, role("student"), async (req, res) => {
  const { rows } = await query(STUDENT_PROFILE_SQL, [req.user.id]);
  if (!rows.length) throw httpError(404, "Student profile not found.");
  res.json(rows[0]);
});

app.put("/api/student/profile", auth, role("student"), async (req, res) => {
  const b = body(req);
  const firstName = text(b.firstName);
  const lastName = text(b.lastName);
  if (!firstName || !lastName) throw httpError(400, "First name and last name are required.");
  // A blank student number must be NULL, not '' — '' would collide on the UNIQUE
  // constraint as soon as a second student saves their profile without one.
  const studentNo = text(b.studentNo) || null;

  await withTransaction(async (db) => {
    await db.query("UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3", [
      firstName,
      lastName,
      req.user.id,
    ]);
    const r = await db.query(
      `UPDATE students
          SET student_no = $1, course = $2, year_level = $3, phone = $4,
              address = $5, bio = $6, skills = $7
        WHERE user_id = $8`,
      [
        studentNo,
        optional(b.course),
        optional(b.yearLevel),
        optional(b.phone),
        optional(b.address),
        optional(b.bio),
        optional(b.skills),
        req.user.id,
      ]
    );
    if (!r.rowCount) throw httpError(404, "Student profile not found.");
  });
  res.json({ message: "Profile updated successfully." });
});

app.post("/api/student/resume", auth, role("student"), upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a file." });
    const r = await query("UPDATE students SET resume_path = $1 WHERE user_id = $2", [
      req.file.filename,
      req.user.id,
    ]);
    if (!r.rowCount) throw httpError(404, "Student profile not found.");
    res.json({ message: "Résumé uploaded successfully." });
  } catch (e) {
    discardUpload(req);
    throw e;
  }
});

app.get("/api/student/applications", auth, role("student"), async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, j.title, j.location, j.type, e.company_name
       FROM applications a
       JOIN students s ON s.id = a.student_id
       JOIN jobs j ON j.id = a.job_id
       JOIN employers e ON e.id = j.employer_id
      WHERE s.user_id = $1
      ORDER BY a.applied_at DESC, a.id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

app.post("/api/applications", auth, role("student"), upload.single("resume"), async (req, res) => {
  try {
    const b = body(req);
    const jobId = toId(b.jobId);
    if (!jobId) throw httpError(400, "Choose a job to apply to.");

    await withTransaction(async (db) => {
      const s = (await db.query("SELECT id, resume_path FROM students WHERE user_id = $1", [req.user.id])).rows[0];
      if (!s) throw httpError(404, "Student profile not found.");

      const j = (
        await db.query(
          `SELECT j.title, j.status, e.user_id AS employer_user_id
             FROM jobs j JOIN employers e ON e.id = j.employer_id
            WHERE j.id = $1`,
          [jobId]
        )
      ).rows[0];
      if (!j) throw httpError(404, "Job not found.");
      if (j.status !== "published") throw httpError(400, "This posting is not open for applications.");

      // Duplicate -> unique violation "one_application" -> 409 "You already applied."
      await db.query(
        "INSERT INTO applications(job_id, student_id, cover_letter, resume_path) VALUES($1, $2, $3, $4)",
        [jobId, s.id, optional(b.coverLetter) ?? "", req.file?.filename || s.resume_path || null]
      );
      await notify(db, j.employer_user_id, "New applicant", `A student applied to ${j.title}.`);
    });
    res.status(201).json({ message: "Application submitted successfully." });
  } catch (e) {
    discardUpload(req);
    throw e;
  }
});

/* ------------------------------------------------------------ notifications */

app.get("/api/notifications", auth, async (req, res) => {
  const { rows } = await query(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC",
    [req.user.id]
  );
  res.json(rows);
});

app.put("/api/notifications/:id/read", auth, async (req, res) => {
  await query("UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: "Marked as read." });
});

/* ----------------------------------------------------------------- employer */

app.get("/api/employer/dashboard", auth, role("employer"), async (req, res) => {
  const { rows } = await query(
    "SELECT id, company_name, approval_status FROM employers WHERE user_id = $1",
    [req.user.id]
  );
  if (!rows.length) throw httpError(404, "Employer profile not found.");
  const employer = rows[0];

  const [stats, apps] = await Promise.all([
    query(
      `SELECT COUNT(*) AS postings,
              COUNT(*) FILTER (WHERE status = 'published') AS published
         FROM jobs WHERE employer_id = $1`,
      [employer.id]
    ),
    query(
      `SELECT COUNT(*) AS applications
         FROM applications a JOIN jobs j ON j.id = a.job_id
        WHERE j.employer_id = $1`,
      [employer.id]
    ),
  ]);
  res.json({ employer, stats: { ...stats.rows[0], ...apps.rows[0] } });
});

app.get("/api/employer/profile", auth, role("employer"), async (req, res) => {
  const { rows } = await query(
    "SELECT e.*, u.email FROM employers e JOIN users u ON u.id = e.user_id WHERE u.id = $1",
    [req.user.id]
  );
  if (!rows.length) throw httpError(404, "Employer profile not found.");
  res.json(rows[0]);
});

app.put("/api/employer/profile", auth, role("employer"), async (req, res) => {
  const b = body(req);
  const companyName = text(b.companyName);
  if (!companyName) throw httpError(400, "Company name is required.");
  const r = await query(
    "UPDATE employers SET company_name = $1, description = $2, location = $3, website = $4 WHERE user_id = $5",
    [companyName, optional(b.description), optional(b.location), optional(b.website), req.user.id]
  );
  if (!r.rowCount) throw httpError(404, "Employer profile not found.");
  res.json({ message: "Company profile updated." });
});

app.get("/api/employer/jobs", auth, role("employer"), async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM jobs
      WHERE employer_id = (SELECT id FROM employers WHERE user_id = $1)
      ORDER BY created_at DESC, id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

app.post("/api/employer/jobs", auth, role("employer"), async (req, res) => {
  const job = parseJob(body(req));
  const id = await withTransaction(async (db) => {
    const employerId = await employerIdFor(db, req.user.id);
    const { rows } = await db.query(
      `INSERT INTO jobs(employer_id, title, description, location, course, type, slots, deadline, status)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`,
      [employerId, job.title, job.description, job.location, job.course, job.type, job.slots, job.deadline]
    );
    const admin = (await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")).rows[0];
    if (admin) await notify(db, admin.id, "New posting awaiting review", `${job.title} needs approval.`);
    return rows[0].id;
  });
  res.status(201).json({ id, message: "Posting submitted for admin approval." });
});

app.put("/api/employer/jobs/:id", auth, role("employer"), async (req, res) => {
  const job = parseJob(body(req));
  const r = await query(
    `UPDATE jobs
        SET title = $1, description = $2, location = $3, course = $4,
            type = $5, slots = $6, deadline = $7, status = 'pending'
      WHERE id = $8
        AND employer_id = (SELECT id FROM employers WHERE user_id = $9)`,
    [job.title, job.description, job.location, job.course, job.type, job.slots, job.deadline, req.params.id, req.user.id]
  );
  if (!r.rowCount) throw httpError(404, "Job not found.");
  res.json({ message: "Posting updated and sent for review." });
});

app.delete("/api/employer/jobs/:id", auth, role("employer"), async (req, res) => {
  const r = await query(
    `UPDATE jobs SET status = 'closed'
      WHERE id = $1
        AND employer_id = (SELECT id FROM employers WHERE user_id = $2)`,
    [req.params.id, req.user.id]
  );
  if (!r.rowCount) throw httpError(404, "Job not found.");
  res.json({ message: "Posting closed." });
});

app.get("/api/employer/applicants", auth, role("employer"), async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.status, a.applied_at, j.title,
            s.student_no, s.course, s.skills, s.resume_path,
            u.first_name, u.last_name, u.email
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
      WHERE j.employer_id = (SELECT id FROM employers WHERE user_id = $1)
      ORDER BY a.applied_at DESC, a.id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

app.put("/api/employer/applications/:id/status", auth, role("employer"), async (req, res) => {
  const status = body(req).status;
  if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });

  await withTransaction(async (db) => {
    // Only the employer who owns the job may change the status. The notification
    // is sent only when this UPDATE matched a row (it used to fire regardless).
    const { rows } = await db.query(
      `UPDATE applications a
          SET status = $1
         FROM jobs j JOIN employers e ON e.id = j.employer_id
        WHERE a.id = $2 AND j.id = a.job_id AND e.user_id = $3
    RETURNING a.student_id, j.title`,
      [status, req.params.id, req.user.id]
    );
    if (!rows.length) throw httpError(404, "Application not found.");

    const student = (await db.query("SELECT user_id FROM students WHERE id = $1", [rows[0].student_id])).rows[0];
    if (student) {
      await notify(db, student.user_id, "Application update", `Your application for ${rows[0].title} is now ${status}.`);
    }
  });
  res.json({ message: "Application status updated." });
});

/* -------------------------------------------------------------------- admin */

app.get("/api/admin/stats", auth, role("admin"), async (_req, res) => {
  const [u, j, a] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE role = 'student')  AS students,
              COUNT(*) FILTER (WHERE role = 'employer') AS employers
         FROM users`
    ),
    query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
              COUNT(*) FILTER (WHERE status = 'published') AS published
         FROM jobs`
    ),
    query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'accepted') AS accepted
         FROM applications`
    ),
  ]);
  res.json({ users: u.rows[0], jobs: j.rows[0], applications: a.rows[0] });
});

app.get("/api/admin/users", auth, role("admin"), async (_req, res) => {
  const { rows } = await query(
    "SELECT id, role, email, first_name, last_name, status, created_at FROM users ORDER BY created_at DESC, id DESC"
  );
  res.json(rows);
});

app.put("/api/admin/users/:id/status", auth, role("admin"), async (req, res) => {
  const status = body(req).status;
  if (!USER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });
  const r = await query("UPDATE users SET status = $1 WHERE id = $2", [status, req.params.id]);
  if (!r.rowCount) throw httpError(404, "User not found.");
  res.json({ message: "User status updated." });
});

app.get("/api/admin/employers", auth, role("admin"), async (_req, res) => {
  const { rows } = await query(
    `SELECT e.*, u.email, u.first_name, u.last_name, u.status
       FROM employers e JOIN users u ON u.id = e.user_id
      ORDER BY e.id DESC`
  );
  res.json(rows);
});

app.put("/api/admin/employers/:id/approval", auth, role("admin"), async (req, res) => {
  const approval = body(req).approvalStatus;
  if (!APPROVAL_STATUSES.includes(approval)) {
    return res.status(400).json({ message: "Invalid approval status." });
  }
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      "UPDATE employers SET approval_status = $1 WHERE id = $2 RETURNING user_id",
      [approval, req.params.id]
    );
    if (!rows.length) throw httpError(404, "Employer not found.");
    await db.query("UPDATE users SET status = $1 WHERE id = $2", [
      approval === "approved" ? "active" : "pending",
      rows[0].user_id,
    ]);
  });
  res.json({ message: "Employer approval updated." });
});

app.get("/api/admin/jobs", auth, role("admin"), async (_req, res) => {
  const { rows } = await query(
    `SELECT j.*, e.company_name
       FROM jobs j JOIN employers e ON e.id = j.employer_id
      ORDER BY j.created_at DESC, j.id DESC`
  );
  res.json(rows);
});

app.put("/api/admin/jobs/:id/status", auth, role("admin"), async (req, res) => {
  const status = body(req).status;
  if (!JOB_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });
  const r = await query("UPDATE jobs SET status = $1 WHERE id = $2", [status, req.params.id]);
  if (!r.rowCount) throw httpError(404, "Job not found.");
  res.json({ message: "Job status updated." });
});

app.get("/api/admin/applications", auth, role("admin"), async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, j.title, e.company_name, u.first_name, u.last_name, u.email
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN employers e ON e.id = j.employer_id
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
      ORDER BY a.applied_at DESC, a.id DESC`
  );
  res.json(rows);
});

app.get("/api/admin/categories", auth, role("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM categories ORDER BY name");
  res.json(rows);
});

app.post("/api/admin/categories", auth, role("admin"), async (req, res) => {
  const b = body(req);
  const name = text(b.name);
  if (!name) throw httpError(400, "Category name is required.");
  try {
    const { rows } = await query(
      "INSERT INTO categories(name, description) VALUES($1, $2) RETURNING id",
      [name, optional(b.description) ?? ""]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === "23505") throw httpError(400, "That category already exists.");
    throw e;
  }
});

app.delete("/api/admin/categories/:id", auth, role("admin"), async (req, res) => {
  await query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.json({ message: "Category deleted." });
});

app.get("/api/admin/announcements", auth, role("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM announcements ORDER BY created_at DESC, id DESC");
  res.json(rows);
});

app.post("/api/admin/announcements", auth, role("admin"), async (req, res) => {
  const b = body(req);
  const title = text(b.title);
  const content = text(b.content);
  const audience = text(b.audience) || "all";
  if (!title || !content) throw httpError(400, "Title and content are required.");
  if (!AUDIENCES.includes(audience)) throw httpError(400, "Invalid audience.");
  const { rows } = await query(
    "INSERT INTO announcements(title, content, audience) VALUES($1, $2, $3) RETURNING id",
    [title, content, audience]
  );
  res.status(201).json({ id: rows[0].id });
});

app.delete("/api/admin/announcements/:id", auth, role("admin"), async (req, res) => {
  await query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
  res.json({ message: "Announcement deleted." });
});

/* ------------------------------------------------------------ fallbacks */

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

const UNIQUE_MESSAGES = {
  users_email_lower_key: "Email already registered.",
  one_application: "You already applied.",
  students_student_no_key: "That student number is already in use.",
  categories_name_lower_key: "That category already exists.",
};
const BAD_INPUT_CODES = new Set([
  "22P02", // invalid text representation (e.g. 'abc' for an integer)
  "22003", // numeric value out of range
  "22007", // invalid datetime format
  "22008", // datetime field overflow
  "22001", // string too long for the column
  "23502", // NOT NULL violation
  "23514", // CHECK violation
]);
const DB_DOWN_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "57P01", "57P03", "53300"]);

// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof multer.MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? res.status(413).json({ message: "File is too large. Maximum size is 5 MB." })
      : res.status(400).json({ message: err.message });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body." });
  if (err.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large." });

  if (err.code === "23505") {
    return res.status(409).json({ message: UNIQUE_MESSAGES[err.constraint] || "That record already exists." });
  }
  if (err.code === "23503") return res.status(400).json({ message: "A related record does not exist." });
  if (BAD_INPUT_CODES.has(err.code)) return res.status(400).json({ message: "Invalid or missing value." });
  if (DB_DOWN_CODES.has(err.code) || /^08/.test(err.code || "") || /Connection terminated|timeout exceeded/i.test(err.message)) {
    console.error("[db] unavailable:", describeDbError(err));
    return res.status(503).json({ message: "The database is temporarily unavailable. Please try again." });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

/* --------------------------------------------------------------------- boot */

async function start() {
  checkJwtSecret();
  try {
    const { schemaReady } = await checkDatabase();
    console.log("[db] connected to PostgreSQL");
    if (!schemaReady) console.warn("[db] Tables not found — run:  npm run db:setup");
  } catch (e) {
    console.error(`[db] Cannot connect: ${describeDbError(e)}`);
    process.exit(1);
  }

  const server = app.listen(PORT, () => console.log(`InternLink API: http://localhost:${PORT}`));

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down.`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
