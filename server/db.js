import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load <project root>/.env no matter which directory the server is started from.
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  quiet: true,
});

const { Pool, types } = pg;

// --- Keep the JSON sent to the React app identical to the MySQL version -----
// DATE -> "YYYY-MM-DD" string. By default `pg` (like mysql2) builds a JS Date at
// *local* midnight, which JSON-serialises to the previous day for servers east
// of UTC (e.g. the Philippines, UTC+8). A plain string avoids that off-by-one.
types.setTypeParser(types.builtins.DATE, (value) => value);
// COUNT()/SUM() return BIGINT, which `pg` hands back as a string by default.
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

export function poolConfig(env = process.env) {
  const base = {
    max: Number(env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
  const ssl =
    env.DB_SSL === "true"
      ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined;

  if (env.DATABASE_URL)
    return { ...base, connectionString: env.DATABASE_URL, ssl };

  return {
    ...base,
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || "postgres",
    password: env.DB_PASSWORD || "123456",
    database: env.DB_NAME || "backend-db",
    ssl,
  };
}

export const pool = new Pool(poolConfig());

// Without this listener an error on an idle client (e.g. the DB restarts) is an
// unhandled 'error' event and crashes the whole Node process.
pool.on("error", (err) =>
  console.error("[db] idle client error:", err.message),
);

/** Run a single query. Returns the pg Result ({ rows, rowCount }). */
export const query = (text, params) => pool.query(text, params);

/**
 * Run `fn(client)` inside BEGIN/COMMIT. Any throw rolls everything back, so
 * multi-step writes (register, apply, approve...) can never half-succeed.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[db] rollback failed:", rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Startup check: can we connect, and has the schema been created? */
export async function checkDatabase() {
  const { rows } = await pool.query(
    "SELECT to_regclass('public.users') AS users_table",
  );
  return { schemaReady: rows[0].users_table !== null };
}

/** Turn low-level driver errors into something a student can act on. */
export function describeDbError(err) {
  const msg = err?.message || String(err);
  if (err?.code === "ECONNREFUSED")
    return "PostgreSQL refused the connection. Is the server running, and are DB_HOST / DB_PORT correct?";
  if (err?.code === "28P01")
    return "PostgreSQL rejected the username or password. Check DB_USER / DB_PASSWORD in .env.";
  if (err?.code === "3D000")
    return `Database "${process.env.DB_NAME || "backend-db"}" does not exist. Run: npm run db:setup`;
  if (/password must be a string/i.test(msg))
    return "PostgreSQL requires a password. Set DB_PASSWORD in .env.";
  return msg;
}
