import jwt from "jsonwebtoken";

const DEV_FALLBACK_SECRET = "development_secret";
const secret = () => process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

/** Called once at startup so a forgotten secret is not silently used in production. */
export function checkJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!s || s === "change_this_secret")
  ) {
    throw new Error(
      "Set a strong JWT_SECRET in the environment before running in production.",
    );
  }
  if (!s || s === "change_this_secret") {
    console.warn(
      "[auth] JWT_SECRET is not set to a private value — fine for local development only.",
    );
  }
}

export const tokenFor = (u) =>
  jwt.sign({ id: u.id, role: u.role, email: u.email }, secret(), {
    expiresIn: "8h",
  });

export function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please log in." });
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ message: "Session expired." });
  }
}

export const role =
  (...allowed) =>
  (req, res, next) =>
    req.user && allowed.includes(req.user.role)
      ? next()
      : res.status(403).json({ message: "Permission denied." });
