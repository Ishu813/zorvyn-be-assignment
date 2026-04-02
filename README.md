## Project overview

This is a REST API backend for a finance dashboard system. It supports user accounts with roles (admin/analyst/viewer), financial transactions with soft-delete, and summary/analytics endpoints for dashboard views.

## Tech stack

- **Node.js + Express**: minimal, fast to build REST APIs
- **PostgreSQL + pg**: relational DB with parameterized queries via `pool.query`
- **JWT (jsonwebtoken)**: stateless auth
- **bcryptjs**: password hashing
- **express-validator**: request validation
- **dotenv + nodemon**: simple DX

## Setup instructions

1. Clone the repo
2. Install dependencies:

```bash
npm install
```

3. Run PostgreSQL locally or use a hosted instance (Neon, Supabase, RDS, etc.). Create an empty database for the app.
4. Create your env file:
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` (and `PGSSLMODE=require` for typical cloud Postgres)
   - Update `JWT_SECRET`
5. (Optional) Seed demo data:

```bash
npm run seed
```

6. Start the server:

```bash
npm run dev
```

The server starts on `PORT` (default `3000`).

### Example: Postgres with Docker

```bash
docker run --name finance-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finance_db -p 5432:5432 -d postgres:16
```

Then set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance_db`.

## Demo credentials (seeded)

- **Admin**: `admin@demo.com` / `Admin@123`
- **Analyst**: `analyst@demo.com` / `Analyst@123`
- **Viewer**: `viewer@demo.com` / `Viewer@123`

## API reference

Base URL: `/api`  
Protected endpoints require `Authorization: Bearer <token>`.

### Auth (`/api/auth`)

- **POST** `/auth/register` — Public
- **POST** `/auth/login` — Public
- **GET** `/auth/me` — Authenticated (any role)

### Users (`/api/users`) — Admin only

- **GET** `/users` — Auth + Role: `admin`
- **GET** `/users/:id` — Auth + Role: `admin`
- **PATCH** `/users/:id` — Auth + Role: `admin`

### Transactions (`/api/transactions`) — Auth required

- **GET** `/transactions` — Auth (viewer/analyst/admin)
- **GET** `/transactions/:id` — Auth (viewer/analyst/admin)
- **POST** `/transactions` — Auth + Role: `admin`
- **PATCH** `/transactions/:id` — Auth + Role: `admin`
- **DELETE** `/transactions/:id` — Auth + Role: `admin` (soft delete)

### Dashboard (`/api/dashboard`) — Analyst/Admin only

- **GET** `/dashboard/summary` — Auth + Role: `analyst` or `admin`
- **GET** `/dashboard/by-category` — Auth + Role: `analyst` or `admin`
- **GET** `/dashboard/monthly-trend` — Auth + Role: `analyst` or `admin`
- **GET** `/dashboard/recent` — Auth + Role: `analyst` or `admin`

## Assumptions made

1. **Registration is open** — any user can self-register. An admin can later change their role.
2. **Soft delete** — deleting a transaction sets `is_deleted = 1`. The record stays in the database but is excluded from all queries and summaries.
3. **Admins cannot modify themselves** — an admin cannot deactivate their own account or downgrade their own role via `PATCH /users/:id`.
4. **Category is free-text** — categories are stored as plain text on each transaction (no master table).
5. **Amounts are always positive** — `type` (income/expense) determines direction.
6. **Dashboard access requires analyst or admin** — viewers can see raw transactions but not analytics.
7. **JWT tokens are not revocable** — no token blocklist; tokens expire per `JWT_EXPIRES_IN`.
8. **Transaction `date` column is `TEXT`** — stored as `YYYY-MM-DD`; filtering uses string comparison. User `created_at` / `updated_at` use `TIMESTAMPTZ` and serialize as ISO timestamps in JSON.

## Design decisions

- **No ORM**: all queries are parameterized raw SQL for clarity and to avoid magic.
- **Async `pg` + `asyncHandler`**: Express 4 does not catch rejected promises; wrappers route errors to the global handler.
- **Soft deletes**: avoids permanently removing data while keeping queries simple (`is_deleted = 0`).
- **RBAC via middleware**: centralized role checks using `requireRole(...roles)` to keep routes readable.
