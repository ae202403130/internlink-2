// Creates the database (if needed), then applies schema.sql and seed.sql.
//
//   npm run db:setup                 create DB + tables + demo data
//   npm run db:setup -- --no-seed    tables only
//   npm run db:setup -- --force      recreate tables even if they already hold data
//
// Works on any OS without needing `psql` on the PATH.
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { poolConfig, describeDbError } from "../server/db.js"; // also loads .env

const here = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const withSeed = !args.has("--no-seed");
const force = args.has("--force");

const read = (file) => fs.readFileSync(path.join(here, file), "utf8");
const config = poolConfig();
const dbName = config.connectionString ? null : config.database;

async function ensureDatabaseExists() {
  if (!dbName) return; // DATABASE_URL points at a database that already exists (hosted Postgres)
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(dbName)) {
    throw new Error(
      `DB_NAME "${dbName}" must start with a letter or number and contain only letters, numbers, underscores, or hyphens.`
    );
  }
  const admin = new pg.Client({ ...config, database: process.env.DB_ADMIN_DATABASE || "postgres" });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database "${dbName}".`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  await ensureDatabaseExists();

  const client = new pg.Client(config);
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
    if (rows[0].t && !force) {
      const { rows: count } = await client.query("SELECT COUNT(*)::int AS n FROM users");
      if (count[0].n > 0) {
        console.error(
          `\nThe database already contains ${count[0].n} user(s). Running setup would DELETE all existing data.\n` +
            "Re-run with --force if that is what you want:  npm run db:setup -- --force"
        );
        process.exitCode = 1;
        return;
      }
    }

    // Each file is sent as one multi-statement simple query, which PostgreSQL
    // executes atomically: a failure leaves the database untouched.
    await client.query(read("schema.sql"));
    console.log("Applied schema.sql");
    if (withSeed) {
      await client.query(read("seed.sql"));
      console.log("Applied seed.sql (demo accounts: see README)");
    }
    console.log("\nDatabase ready. Start the app with: npm run dev");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`\nSetup failed: ${describeDbError(e)}`);
  process.exit(1);
});
