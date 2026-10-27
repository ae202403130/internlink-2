# InternLink — WMSU Career & Internship Portal

Full-stack classroom prototype:
React/Vite + Express REST API + **PostgreSQL** + JWT + bcrypt + résumé upload.

## SETUP

Requires Node.js 20.19+ and PostgreSQL 12+ (installer: https://www.postgresql.org/download/ — remember the
password you choose for the `postgres` user).

1. `npm install`
2. Copy `.env.example` to `.env` and set `DB_PASSWORD` (and `DB_USER` / `DB_PORT` if yours differ).
3. `npm run db:setup`   — creates the `internlink` database, the tables, and the demo data.
4. `npm run dev`
5. Open http://localhost:5173

API: http://localhost:5000  ·  Health: http://localhost:5000/api/health

### Doing the database step by hand (psql / pgAdmin)
```
createdb -U postgres internlink
psql -U postgres -d internlink -f database/schema.sql -f database/seed.sql
```
In pgAdmin: create a database called `internlink`, open the Query Tool on it, and run `database/schema.sql`
and then `database/seed.sql`.

`npm run db:setup` refuses to run over a database that already has users. To wipe and rebuild on purpose:
`npm run db:setup -- --force` (add `--no-seed` to skip the demo data).

### Hosted PostgreSQL (Neon, Supabase, Render, …)
Put the provider's connection string in `.env` instead of the `DB_*` values:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_SSL=true
```

## DEMO
Student: student@wmsu.edu.ph / student123
Employer: employer@wmsu.edu.ph / employer123
Admin: admin@wmsu.edu.ph / admin123

## TROUBLESHOOTING
The server checks the database when it starts and prints the reason if it cannot connect:

| Message | Fix |
|---|---|
| `refused the connection` | PostgreSQL isn't running, or `DB_HOST` / `DB_PORT` is wrong (default port is 5432). |
| `rejected the username or password` | Fix `DB_USER` / `DB_PASSWORD` in `.env`. |
| `Database "internlink" does not exist` | Run `npm run db:setup`. |
| `Tables not found` | Run `npm run db:setup`. |

Unexpected server errors are logged in the terminal running the API; the browser only sees a generic message.

## NOTES ON THE POSTGRESQL VERSION
The Express routes, request bodies and response JSON are the same as the MySQL version, so the React app is unchanged.
Things that behave differently on purpose:

- Search filters use `ILIKE` (PostgreSQL's `LIKE` is case-sensitive; MySQL's was not).
- Job `deadline` is returned as `YYYY-MM-DD`. The MySQL driver returned a JavaScript date that shifted the deadline one
  day earlier on every edit for servers east of UTC (e.g. the Philippines).
- Dashboard/report counts are real numbers (`2`) rather than the strings (`"2"`) the MySQL driver produced for `SUM()`.
- Multi-step writes (register, apply, approve employer, …) run in a transaction.
- Email addresses are unique and matched case-insensitively, as before.

This is an educational prototype. Production deployment still needs HTTPS, stronger security,
rate limiting, secure token storage, hardened uploads, validation and production secrets.
