# 🎬 CINEBOOK – Cinema Booking & Management System

A full-stack cinema ticket booking platform. Customers browse movies, pick a theatre and showtime, choose
seats on an interactive seat map and book tickets. Administrators manage movies, theatres, screens, seat
layouts, showtimes, bookings and customers from a dashboard.

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Bootstrap 5, Bootstrap Icons (built with Vite) |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | PostgreSQL 16 |
| Deployment | Docker, Docker Compose, Nginx (reverse proxy) |

Everything runs behind **one URL: http://localhost**. There are no separate frontend or backend ports.

---

## 1. Quick start (macOS, Apple Silicon)

**Prerequisite:** [Docker Desktop for Mac (Apple chip)](https://www.docker.com/products/docker-desktop/), installed and running.
All base images (`python:3.12-slim`, `node:20-alpine`, `nginx:1.27-alpine`, `postgres:16-alpine`) are
multi-arch, so they build natively for `arm64`. No emulation is needed.

```bash
cd ~/Documents/cinema-booking
```

```bash
cp .env.example .env
```

Generate real secrets and put them in `.env` (`POSTGRES_PASSWORD`, `JWT_SECRET_KEY`, `ADMIN_PASSWORD`):

```bash
sed -i '' -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" -e "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$(openssl rand -hex 32)/" .env
```

Then open `.env` and set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to the admin login you want.

Build the images and start all four containers:

```bash
docker compose up -d --build
```

Open **http://localhost**. Log in to the admin dashboard with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
Customers sign up from the **Sign up** button.

> Port 80 already in use? Set `HTTP_PORT=8080` in `.env`, run `docker compose up -d`, and use http://localhost:8080
> (also add that origin to `CORS_ORIGINS`).

---

## 2. Project structure

```
cinema-booking/                 (the CINEBOOK project root)
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app, routers, error handlers
│   │   ├── config.py           settings from environment variables
│   │   ├── database/           engine, session, declarative base
│   │   ├── models/             SQLAlchemy models (users, movies, theatres, screens, seats,
│   │   │                       showtimes, bookings, booking_seats, payments)
│   │   ├── schemas/            Pydantic request/response validation
│   │   ├── routes/             REST endpoints (auth, movies, theatres, screens, showtimes,
│   │   │                       bookings, admin)
│   │   └── services/           security (bcrypt/JWT), booking engine, seat generation, seed data
│   ├── alembic/                database migrations
│   ├── entrypoint.sh           wait for DB → migrate → seed → start uvicorn
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                axios client (JWT header, error handling)
│   │   ├── context/            auth + toast providers
│   │   ├── components/         navbar, seat grid, modals, cards…
│   │   ├── pages/              customer pages
│   │   └── pages/admin/        admin dashboard pages
│   ├── public/
│   ├── nginx-spa.conf          SPA serving inside the frontend container
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf              reverse proxy (the public entry point)
│   ├── proxy_params.conf
│   └── Dockerfile
├── scripts/smoke_test.py       end-to-end API test suite
├── docker-compose.yml
├── .env.example
├── .dockerignore
└── README.md
```

---

## 3. Architecture

```
Browser ──► http://localhost:80
              │
        ┌─────▼──────────── cinebook-nginx (reverse proxy) ────────────┐
        │  /          → frontend:80   (React build, SPA fallback)      │
        │  /api/*     → backend:8000  (FastAPI)                        │
        │  /media/*   → shared volume (uploaded posters)               │
        └──────────────────────────────────────────────────────────────┘
                   │                          │
          cinebook-frontend           cinebook-backend ──► cinebook-db (PostgreSQL)
          (nginx + static build)      (uvicorn, 2 workers)   volume: postgres_data
```

| Container | Image | Purpose |
|---|---|---|
| `cinebook-nginx` | `cinebook-nginx` | Only container with a published port (80). Routes traffic, gzip, security headers, rate-limits login/register. |
| `cinebook-frontend` | `cinebook-frontend` | Multi-stage build: Node builds React, then nginx serves `dist/` with `try_files … /index.html` so page refreshes on deep links work. |
| `cinebook-backend` | `cinebook-backend` | FastAPI on Uvicorn. Runs as a non-root user. On start it waits for Postgres, runs `alembic upgrade head`, ensures the admin account and seeds sample data (first run only). |
| `cinebook-db` | `postgres:16-alpine` | Data persisted in the `postgres_data` named volume. Not reachable from the host. |

Volumes: `postgres_data` (database) and `media_data` (uploaded posters, shared read-only with nginx).
All services use `restart: unless-stopped` and health checks, so they recover after a restart or reboot of Docker Desktop.

---

## 4. Features

### Customer
- Register / log in (JWT), profile and password change
- Browse "Now Showing" with search, genre and language filters; featured hero carousel
- Movie page: poster, description, genre, duration, rating, certificate, cast, **trailer (YouTube/Vimeo modal)**
- Showtimes by date (7-day strip) and city, grouped by theatre; availability colour (available / filling fast / housefull)
- Theatre pages with what's playing per day
- **Interactive seat map**: categories (Standard / Premium / Recliner) with prices, available / selected / booked / unavailable colours, aisle gap, live refresh every 20s
- Automatic price calculation (per-category price + convenience fee), **re-computed on the server**
- Checkout with payment method → booking confirmation with a unique **booking ID** (e.g. `CBLP4JCG9R`), printable ticket
- Booking history (Upcoming / Past / Cancelled) and **cancellation with the refund policy**

### Cancellation policy (configurable in `.env`)
| Time before show | Customer refund |
|---|---|
| ≥ 24 h (`FULL_REFUND_HOURS`) | 100 % of ticket price |
| 2–24 h | `PARTIAL_REFUND_PERCENT` (50 %) |
| < 2 h (`CANCELLATION_CUTOFF_HOURS`) | Online cancellation closed |

The convenience fee is non-refundable. Administrators can cancel at any time with a full refund.
Cancelled seats are released immediately for re-sale.

### Admin dashboard (`/admin`)
- **Dashboard:** totals for movies, theatres, screens, bookings, customers, tickets sold, gross / refunded / net revenue, 7-day revenue chart, top movies, recent bookings
- **Movies:** create / list / search / update / delete, **poster upload** (JPEG/PNG/WEBP ≤ 5 MB, type-checked) or URL, genre, language, duration, rating, certificate, release date, cast, director, trailer, show/hide
- **Theatres:** CRUD with address, city, state, PIN, phone, amenities
- **Screens & seats:** CRUD per theatre; screen type (2D/3D/IMAX/4DX); seats per row and ordered **seat-category blocks** → seat map generated automatically; click seats to disable/enable them
- **Showtimes:** create / update / delete; assign a movie to a screen; date and time; per-category ticket prices; open/close for booking; occupancy bars; **overlap prevention** on the same screen (movie duration + 15 min cleaning buffer)
- **Bookings:** paginated list, search by booking ID / customer / movie, filter by booking and payment status, detail view with customer, seats and payment, update booking status (Confirmed ↔ Completed, Cancel), update payment status, cancel & refund
- **Customers:** search, view details with booking history and total spent, edit name / email / phone / role / active flag, delete account

> **Payments are simulated.** Choosing UPI / Card / Net Banking / Wallet marks the payment as `PAID` with a
> transaction reference. No card or bank details are collected. A real gateway (Razorpay, Stripe…) would plug
> into `backend/app/services/booking_service.py`.

---

## 5. Database design

```
users ─1───*─ bookings ─*───1─ showtimes ─*───1─ movies
                 │  1             │ *
                 │                └───1─ screens ─*───1─ theatres
                 ├─*─ booking_seats ─*───1─ seats ─*───1─ screens
                 └─1─ payments
```

| Table | Key constraints |
|---|---|
| `users` | unique email; `role IN ('admin','customer')` |
| `movies` | duration 1–600; rating 0–10 |
| `theatres` | has many screens (cascade) |
| `screens` | FK theatre; unique (theatre, name); type check; JSONB seat layout |
| `seats` | FK screen; unique (screen, row, number); category check |
| `showtimes` | FK movie, FK screen; `end_time > start_time`; **`EXCLUDE USING gist`**, so no two active shows overlap on a screen |
| `bookings` | unique `booking_code`; FK user (cascade), FK showtime (**restrict**); status check |
| `booking_seats` | **partial unique index `(showtime_id, seat_id) WHERE is_active`**, so a seat can never be sold twice for the same show |
| `payments` | one per booking; unique transaction ref; status/method checks |

Migrations live in `backend/alembic/versions/` and run automatically on container start. Create a new one after changing a model:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

---

## 6. Security

- **Passwords:** bcrypt (cost 12); never returned by the API
- **Auth:** JWT (HS256) bearer tokens; secret only from `JWT_SECRET_KEY`
- **RBAC:** `admin` and `customer` roles enforced by FastAPI dependencies on every admin route (401 unauthenticated, 403 wrong role)
- **Validation:** Pydantic schemas on every request (lengths, ranges, email, phone, enums); readable 422 messages
- **SQL injection:** all queries go through SQLAlchemy with bound parameters; no string-built SQL
- **Secrets:** all credentials come from `.env`, which is git-ignored; compose refuses to start without the DB variables
- **Seat concurrency:** a booking locks the showtime row (`SELECT … FOR UPDATE`), re-checks availability, and the partial unique index is the final guarantee. Tested with 8 simultaneous requests for one seat: exactly one succeeds, 7 get `409`
- **Uploads:** content-type allow-list, magic-byte check, size limit, random file names
- **Errors:** consistent JSON `{ "detail": … }`; integrity violations become `409`; unexpected errors are logged and return a generic `500`
- **Nginx:** rate limit on login/register (`429`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `server_tokens off`

---

## 7. Step-by-step: how it was built and how to run each stage

1. **Create the project directory:** `mkdir -p ~/Documents/cinema-booking && cd ~/Documents/cinema-booking`, then the `backend/`, `frontend/` and `nginx/` folders shown above.
2. **Create the frontend:** Vite + React (`frontend/package.json`); `npm install` produced `package-lock.json` for reproducible `npm ci` builds.
3. **Create the FastAPI backend:** `backend/app` with models, schemas, routes and services; dependencies pinned in `requirements.txt`.
4. **Connect PostgreSQL:** `app/config.py` builds the connection URL from `POSTGRES_*` variables; `app/database/session.py` creates the engine; Alembic migrates the schema.
5. **Implement the CRUD APIs:** see the endpoint table below. Interactive docs are at **http://localhost/api/docs**.
6. **Connect frontend and backend:** the React app calls relative `/api/...` URLs (`src/api/client.js`); Nginx routes them, so no CORS or extra ports are involved.
7. **Configure Nginx:** `nginx/nginx.conf` (proxy) + `frontend/nginx-spa.conf` (SPA refresh support).
8. **Create the Dockerfiles:** multi-stage `backend/Dockerfile`, `frontend/Dockerfile`, and `nginx/Dockerfile`.
9. **Create the Docker Compose configuration:** `docker-compose.yml` with 4 services, 2 networks, 2 volumes and health-checked startup order.
10. **Build the Docker images:**
    ```bash
    docker compose build
    ```
    ```bash
    docker images | grep cinebook
    ```
    This produces `cinebook-frontend`, `cinebook-backend` and `cinebook-nginx`.
11. **Run the containers:**
    ```bash
    docker compose up -d
    ```
    ```bash
    docker compose ps
    ```
12. **Test the application:** see section 9.
13. **Open it in your browser:** **http://localhost**.

---

## 8. REST API overview

All endpoints are prefixed with `/api`. 🔒 = login required, 👑 = admin only.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/token` (Swagger), 🔒 `GET/PUT /auth/me` |
| Movies | `GET /movies`, `GET /movies/{id}`, 👑 `POST /movies`, 👑 `PUT/DELETE /movies/{id}` |
| Theatres | `GET /theatres`, `GET /theatres/cities`, `GET /theatres/{id}`, 👑 `POST`, 👑 `PUT/DELETE /theatres/{id}` |
| Screens | `GET /screens?theatre_id=`, `GET /screens/{id}`, 👑 `POST`, 👑 `PUT/DELETE /screens/{id}`, 👑 `PATCH /screens/seats/{seat_id}` |
| Showtimes | `GET /showtimes?movie_id=&theatre_id=&city=&start_from=&start_to=`, `GET /showtimes/{id}`, `GET /showtimes/{id}/seats`, 👑 `POST`, 👑 `PUT/DELETE /showtimes/{id}` |
| Bookings | 🔒 `POST /bookings`, 🔒 `GET /bookings/me`, 🔒 `GET /bookings/{code}`, 🔒 `GET /bookings/{code}/cancellation`, 🔒 `POST /bookings/{code}/cancel` |
| Admin | 👑 `GET /admin/stats`, 👑 `GET /admin/bookings`, 👑 `GET/PATCH /admin/bookings/{code}`, 👑 `POST /admin/bookings/{code}/cancel`, 👑 `GET /admin/customers`, 👑 `GET/PUT/DELETE /admin/customers/{id}`, 👑 `POST /admin/uploads/poster` |
| Health | `GET /health` |

---

## 9. Testing

**Automated end-to-end suite** (60 checks: public browsing, auth and validation, RBAC, SQL-injection attempt,
booking, server-side pricing, double booking, **concurrent booking race**, cancellation and refund, seat release,
and admin CRUD for every entity, including poster upload, overlap rejection, and delete protection). It uses only
the Python standard library and cleans up its own data:

```bash
python3 scripts/smoke_test.py http://localhost "$(grep ^ADMIN_EMAIL .env | cut -d= -f2)" "$(grep ^ADMIN_PASSWORD .env | cut -d= -f2)"
```

**Manual walkthrough:**
1. http://localhost → open a movie → watch the trailer → pick a date and showtime.
2. Sign up, select seats (watch the total update), choose a payment method, **Pay & Book** → confirmation with booking ID.
3. **My Bookings** → **Cancel** → the refund amount follows the policy; the seats become available again.
4. Log in as admin → **Dashboard** stats → add a movie with a poster → add a theatre → add a screen with a custom layout → create a showtime → book it as a customer → find the booking by ID under **Bookings**.

**Restart and persistence check:**

```bash
docker compose down && docker compose up -d
```

Data, bookings and uploaded posters remain (named volumes). Migrations are idempotent, and the seed only runs on an empty database.

---

## 10. Everyday commands

| Task | Command |
|---|---|
| Follow logs | `docker compose logs -f backend nginx` |
| Rebuild after code changes | `docker compose up -d --build` |
| Stop (keep data) | `docker compose down` |
| Stop and **delete all data** | `docker compose down -v` |
| Add another week of showtimes | `docker compose exec backend python -m app.services.seed --showtimes` |
| PostgreSQL shell | `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |
| Back up the database | `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql` |
| Frontend dev server with hot reload (stack running) | `cd frontend && npm install && npm run dev`, then open http://localhost:5173 |

The sample showtimes cover the 7 days after the first start. Run the `--showtimes` command above to add more,
or create showtimes in the admin dashboard.

## 11. Sample content and licensing

The starter catalogue uses the Blender Foundation's open movies (*Sintel*, *Tears of Steel*, *Big Buck Bunny*,
*Sprite Fright*, *Cosmos Laundromat*, *Spring*, *Agent 327*, *Charge*), released under Creative Commons
Attribution and linked to their official trailers. Posters are generated placeholders. Theatres are fictional.
Set `SEED_SAMPLE_DATA=false` before the first start to begin with an empty catalogue.

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop (`open -a Docker`) and wait for it to show "running". |
| `port is already allocated` on 80 | Another service is using port 80. Set `HTTP_PORT=8080` in `.env`. |
| `set POSTGRES_USER in .env` | You haven't created `.env`. Run `cp .env.example .env`. |
| Changed `POSTGRES_PASSWORD` after the first run and the backend can't connect | The database keeps its original password. Restore the old value, or reset with `docker compose down -v` (deletes data). |
| Login says "Too many requests" | Nginx rate limit on auth endpoints. Wait a minute. |
