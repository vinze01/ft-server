# ft-server — Finance Tracker API

Express 4 + TypeScript + Sequelize/PostgreSQL REST API behind the Vue app in [`../ft-client`](../ft-client). It owns authentication, all finance-domain data, analytics, savings/automation engines, notifications, export/import, and security (2FA + sessions).

See the [root README](../README.md) for the product overview, full feature matrix, and environment/API reference.

## Tech stack

- **Node.js + Express 4** — CommonJS, `server.ts` entry point.
- **TypeScript** — `strict: true`, compiled with `tsc` to `dist/`; dev runs via `ts-node`.
- **Sequelize 6 + `pg`** — PostgreSQL only. Models are defined in `models/`, `sequelize.sync({ alter: false })` runs on every boot.
- **sequelize-cli** — migrations in `migrations/`, config in `config/config.js`.
- **Auth** — `jsonwebtoken` (7-day expiry, secret from `JWT_SECRET` — the server refuses to boot in production without it), `bcryptjs` password hashing.
- **Uploads / mail / 2FA** — `multer` (memory storage) → Cloudinary avatars, `nodemailer` for password reset, `speakeasy` + `qrcode` for TOTP.
- **Rate limiting** — `express-rate-limit` (see [Security](#security)).

## Requirements

- Node.js (current LTS) and npm
- PostgreSQL running locally

## Getting started

```bash
cd ft-server
npm install
cp .env.example .env    # fill in the variables from the table below
npm run migrate         # applies migrations/
npm run dev             # ts-node server.ts → http://localhost:3001
```

Check `GET http://localhost:3001/health` → `{ "status": "ok", "timestamp": "..." }`.

On boot the server calls `sequelize.authenticate()` then `sequelize.sync({ alter: false })`, so missing tables are created even without running migrations. Run migrations anyway to keep `SequelizeMeta` consistent with `sql/create_tables.sql`.

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `ts-node server.ts` | Dev server on `PORT` (default `3001`) |
| `npm run build` | `tsc` | Compile to `dist/` |
| `npm start` | `node dist/server.js` | Run the compiled build |
| `npm run migrate` | `npx sequelize-cli db:migrate` | Apply migrations |
| `npm run migrate:undo` | `npx sequelize-cli db:migrate:undo` | Revert the last migration |

`npm test` is the npm placeholder (`echo "Error: no test specified" && exit 1`) and fails by design. There is no lint, format, typecheck, seed, or deploy script. For an ad-hoc typecheck use `npx tsc --noEmit`.

## Environment variables

`.env.example` only ships the `DB_*`/`PORT` subset. The full set the code reads:

| Variable | Required for | Example |
|---|---|---|
| `DB_HOST` | Sequelize connection (default `localhost`) | `localhost` |
| `DB_PORT` | Sequelize connection (default `5432`) | `5432` |
| `DB_NAME` | Sequelize connection | `finance_tracker` |
| `DB_USER` | Sequelize connection | `postgres` |
| `DB_PASSWORD` | Sequelize connection | `your_password_here` |
| `DB_SSL` | set `true` when the database requires TLS (Neon, Render Postgres, Supabase) | `false` |
| `PORT` | Express listen (default `3001`) | `3001` |
| `CLIENT_URL` | frontend URL used in password-reset email links | `http://localhost:5173` |
| `CORS_ORIGIN` | comma-separated allowed browser origins (CORS); unset = permissive (dev only) | `https://your-app.pages.dev` |
| `JWT_SECRET` | token signing/verification — **required in production** (server exits at boot without it); generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | `your_jwt_secret` |
| `EMAIL_HOST` | password-reset mail | `smtp.example.com` |
| `EMAIL_PORT` | password-reset mail | `587` |
| `EMAIL_USER` | password-reset mail | `you@example.com` |
| `EMAIL_PASS` | password-reset mail | `your_email_password` |
| `CLOUDINARY_CLOUD_NAME` | avatar upload | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | avatar upload | `your_api_key` |
| `CLOUDINARY_API_SECRET` | avatar upload | `your_api_secret` |

Also read by `config/config.js`: `DB_NAME_TEST` and `DB_NAME_PROD` for the `test`/`production` CLI environments. Password-reset links point at `CLIENT_URL` (default `http://localhost:5173`). `.env` is gitignored — never commit real secrets.

## Project structure

```text
ft-server/
├── server.ts               # boot: cors, json/urlencoded, /api router, /health, sync, listen
├── routes/index.ts         # ~100 route registrations (source of truth for the API)
├── controllers/            # 18 controllers (function-style and class-singleton styles)
├── models/                 # 18 Sequelize models + index.ts re-export
├── middleware/auth.ts      # authMiddleware (Bearer JWT → req.userId)
├── config/
│   ├── database.ts         # Sequelize instance used by the app
│   └── config.js           # sequelize-cli environments
├── migrations/             # 5 migrations (20240403 ×2, 20240405, 20260908 ×2)
├── sql/create_tables.sql   # full DDL reference for all 18 tables
├── types/                  # finance.ts, user.ts shared request/response shapes
└── .env.example
```

### Controllers

| Controller | Area |
|---|---|
| `authController`, `passwordController` | Register/login/`/me`, forgot/reset password |
| `userController` | Profile, password, avatar, account deletion |
| `dashboardController` | Period-aware dashboard summary |
| `expenseController`, `incomeController`, `budgetController` | Core tracking CRUD |
| `accountController` | Accounts, summary, transfers, transfer history |
| `billController` | Bills/subscriptions, due-soon, mark paid/unpaid |
| `goalController` | Goals, contributions, progress |
| `recurringController` | Templates, manual execute, upcoming |
| `tagController` | Tags + linking income/expense rows |
| `savingsController` | Savings config, calculate/allocate, projections |
| `automationController` | Rule CRUD, dry-run test, run-all |
| `analyticsController` | Category breakdowns, trends, burn rate, net worth, savings rate |
| `exportController` | CSV/JSON export, full backup, template, CSV import |
| `securityController` | 2FA, sessions/devices, password change |
| `notificationController` | Notification center + delivery settings |

## Architecture

```text
routes/index.ts → controller (function or bound singleton) → Sequelize models → PostgreSQL
```

- **No service layer.** Business logic lives in controllers; wire new routes in `routes/index.ts`.
- **Every user-owned query is scoped by `req.userId`** (`where: { userId }`). There are no roles — isolation is per row.
- **Auth.** `authenticate` (from `controllers/authController`) or `authMiddleware` (`middleware/auth.ts`) verifies the Bearer token and sets `req.userId`. Every `/api` route is protected except `POST /register`, `POST /login`, `POST /forgot-password`, `POST /reset-password`, and `GET /import/template`.
- **JWT payload** is `{ userId }`, 7-day expiry, secret `process.env.JWT_SECRET || 'f1n4nc3'`.
- **Error handling.** `async/await` in try/catch → `res.status(4xx/5xx).json({ error })` (some controllers return `{ success: false, error }`).
- **Uploads.** `multer.memoryStorage()` → Cloudinary (`finance-tracker-upload/avatars/`); always validate `req.file` first.
- **Money** is `DECIMAL(10,2)` (`accounts` use `15,2`); see model definitions.
- The `Insight` (`insights_cache`) model is exported but unused by any controller or route — leave it alone unless explicitly asked.

## Security

- **Rate limiting** (`middleware/rateLimiter.ts`) — `apiLimiter`: 300 requests / 15 min per IP on every `/api` route (applied in `server.ts`); `authLimiter`: 20 requests / 15 min on `POST /register|/login|/forgot-password|/reset-password`. Both send `RateLimit-*` headers and a JSON `{ error }` body on rejection.
- **SQL injection** — all queries go through Sequelize's parameterized API; there are no raw queries, no string-built `where` clauses, and no user-controlled `order`/`limit`. Defense-in-depth: `router.param('id', validateIdParam)` (`middleware/validateId.ts`) rejects any `:id` that is not a positive integer with `400 { error: 'Invalid id parameter' }` before the controller runs.
- **Passwords** — bcrypt (cost 10) on every write path; `securityController.changePassword` verifies the current password before hashing the new one.
- **Reset tokens** — `forgotPassword` generates a 32-byte random token, emails it once, and stores only its SHA-256 hash in `users.resetToken`; `resetPassword` hashes the incoming token to look it up. The response is identical whether or not the email exists (no user enumeration).
- **JWT** — `JWT_SECRET` is required in production; boot fails fast rather than falling back to the historical default.
- **Uploads** — avatar uploads (`avatarUpload` in `routes/index.ts`) accept images only, max 5 MB; the CSV import keeps the unrestricted `upload` instance because it needs non-image files.
- **Sessions** — every login records a `Session` row (SHA-256 token hash, device info, IP, 7-day expiry), which is what the Settings sessions/devices list reads.

Known gaps: `cors()` is wide open, no `helmet` headers, `nodemailer` 8 has open audit advisories, and the TOTP secret shares `User.resetToken` with password reset (2FA is also not enforced at login).

## Database

18 models → 18 tables. Reference DDL: `sql/create_tables.sql`.

`users`, `expenses`, `incomes`, `budgets`, `accounts`, `account_transfers`, `tags`, `transaction_tags`, `recurring_transactions`, `bills`, `goals`, `savings_configs`, `savings_allocations`, `automation_rules`, `notifications`, `user_notification_settings`, `insights_cache`, `sessions`.

Conventions:

- Integer `id` primary keys.
- `userId` foreign key with `ON DELETE CASCADE` on every user-owned table.
- `createdAt`/`updatedAt` timestamps on every table except the `transaction_tags` join table.
- Period columns for income/budget: `month` (name, e.g. `"January"`), `type` (`monthly | yearly | bi-monthly`), `year`, `halfMonth` (`1 | 2 | null`).

Any schema change needs three synchronized edits: the Sequelize model, a new `migrations/YYYYMMDDHHMMSS-name.js` (via `queryInterface`), and `sql/create_tables.sql`. Then run `npm run migrate`.

## Testing and linting

None configured. No test runner, test files, ESLint/Prettier, or `.editorconfig`. Use `npx tsc --noEmit` for ad-hoc type checking; do not claim tests pass.

## Known issues

- The TOTP secret is stored in `User.resetToken`, shared with the password-reset flow (password-reset tokens themselves are SHA-256 hashed). 2FA is not enforced at login — there is no persistent "enabled" flag.
- `npm audit` still reports `nodemailer` 8 (high; fix needs the breaking 8 → 10 upgrade) and `qs` 6.14.3 under Express (moderate; fixable with an npm `overrides` entry forcing ≥ 6.16.2).
- `cors()` is wide open and there are no `helmet` security headers.

## License

`package.json` declares `ISC`, but no license file exists in this package.
