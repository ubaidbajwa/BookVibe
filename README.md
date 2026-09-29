# BookVibe

A property-booking platform for Pakistan, built as a final-year project.

BookVibe connects guests looking for short- and long-term stays with hosts who
list rooms, apartments, houses, hotels, and hostels. It handles the full booking
lifecycle: searching listings, booking with either cash-on-arrival or a Stripe
card payment held in escrow, host payouts after a platform commission, guest and
host identity verification against the Pakistani CNIC, reviews, complaints, and
an admin panel for moderation and payout approval. It is a solo project and is
not deployed publicly.

There is no hosted demo yet. Running it requires setting up the three services
below plus external accounts (MongoDB, Cloudinary, Stripe, and — for identity
verification — Google Cloud Vision and AWS Rekognition).

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Screenshots](#screenshots)
- [Features by role](#features-by-role)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Status and known limitations](#status-and-known-limitations)

## Architecture

Three independent services communicate over HTTP and WebSockets:

```
                +-------------------------------+
  Browser  <--->|  Frontend (React SPA, Vite)   |
                +-------------------------------+
                     |  REST /api/v1  +  Socket.io
                     v
                +-------------------------------+       +-------------------+
                |  Backend (Express 5 API)      |<----->|  MongoDB (Atlas)  |
                |  auth, bookings, payments,    |       +-------------------+
                |  escrow, notifications        |
                +-------------------------------+
                   |            |             |
     Stripe  <-----+            |             +-----> Cloudinary (image storage)
   (checkout +                  |
    webhooks)                   v
                +-------------------------------+       +------------------------+
                |  Verification service         |<----->|  Google Cloud Vision   |
                |  (FastAPI, Python)            |       |  AWS Rekognition       |
                |  CNIC OCR / face / liveness   |       +------------------------+
                +-------------------------------+
```

- **Frontend** is a single-page app. All API calls go through a shared Axios
  instance that silently refreshes the access token on a 401 and replays the
  request. State lives in Redux Toolkit (`auth`, `accommodation`, `booking`
  slices). Socket.io delivers live notifications.
- **Backend** is the source of truth. It owns authentication, business rules,
  Stripe checkout and webhook handling, escrow accounting, and all Socket.io and
  Web Push notifications. Uploaded images are streamed to Cloudinary; only the
  URL and `public_id` are stored in MongoDB.
- **Verification service** is called only by the backend (server-to-server,
  guarded by a shared-secret header). It never performs OCR or face matching for
  the browser directly. The one browser-facing piece is AWS Face Liveness: the
  backend creates a session, the browser streams the video challenge to AWS via
  the Amplify SDK, and the backend fetches the result.

Authentication is a dual-token flow. A short-lived access token (default 15 min)
is sent as an `Authorization: Bearer` header or a `token` cookie. A long-lived
refresh token (default 7 days) is stored as a SHA-256 hash on the user document
and sent as an httpOnly cookie; `POST /api/v1/user/refresh` rotates it. Roles
(`guest`, `host`, `admin`) all live in one `UserAndHost` collection and are
enforced per route. Admin data routes require a second factor on top of the
role: a server-verified 6-digit PIN that issues a short-lived gate token.

## Tech stack

**Frontend**
- React 19, Vite 7, React Router 7
- Redux Toolkit + React Redux
- Tailwind CSS v4, Lucide / React Icons, Framer Motion
- Leaflet + React Leaflet (maps)
- Axios, Socket.io client
- AWS Amplify UI (`@aws-amplify/ui-react-liveness`) for the Face Liveness widget
- Stripe.js / React Stripe.js

**Backend**
- Node.js (ESM), Express 5, Mongoose 8 (MongoDB)
- Socket.io, Stripe, Cloudinary
- JWT (`jsonwebtoken`), bcrypt, Helmet, `express-rate-limit`, `express-fileupload`
- Nodemailer (Gmail transactional email), `web-push` (VAPID), Twilio (SMS — optional)
- `node-cron` (daily admin digest), `ioredis` (optional)

**Verification service (Python)**
- FastAPI + Uvicorn, Pydantic
- `google-cloud-vision` — CNIC OCR
- `boto3` — AWS Rekognition (face match, `detect_faces` quality check, and active
  Face Liveness sessions)

## Screenshots

No screenshots are committed yet. The `docs/screenshots/` folder is set up with
the intended file names and a capture guide (`docs/screenshots/README.md`).

Once the images are added, uncomment the block below in this file:

<!--
| | |
|---|---|
| ![Home & property search](docs/screenshots/01-home.png) | ![Property detail with pricing](docs/screenshots/02-property-detail.png) |
| ![Booking & payment](docs/screenshots/03-booking-checkout.png) | ![Identity verification (CNIC + liveness)](docs/screenshots/04-kyc-verification.png) |
| ![Guest bookings](docs/screenshots/05-my-bookings.png) | ![Host dashboard & earnings](docs/screenshots/06-host-dashboard.png) |
| ![Add / manage listing](docs/screenshots/07-add-property.png) | ![Admin dashboard & analytics](docs/screenshots/08-admin-dashboard.png) |
-->

## Features by role

Derived from the routes and controllers, not aspiration.

**Guest**
- Browse and search listings by city, type, dates, and price; compare up to three
  side by side; save to a wishlist.
- Book a stay with a transparent cost breakdown, choosing cash-on-arrival or
  Stripe card payment. Optionally add concierge services and a pre-ordered meal.
- Complete identity verification: CNIC OCR, face match against the CNIC photo,
  and an active liveness challenge.
- Leave a review after a completed stay, file complaints with evidence, and use an
  in-stay emergency SOS that alerts the host.
- Manage profile, settings, notification preferences, and account
  deactivation/deletion.

**Host**
- Create and manage listings, including multi-unit properties (hotels/hostels with
  individual rooms), house rules, cancellation policy, and damage deposits.
- View a bookings dashboard and earnings summary; confirm cash payments; release
  or claim security deposits; handle refund requests.
- Publish a per-property food menu and concierge services, and process their
  orders.
- Register bank / Easypaisa / JazzCash payout details and request payouts once an
  admin verifies them.

**Admin** (behind a secret path + a server-enforced PIN gate)
- Dashboard stats and platform analytics.
- User management: list, block/unblock, delete; verify hosts and properties.
- KYC review queue: approve or reject identity submissions.
- Complaint moderation with a message thread to both parties.
- Blacklist management by CNIC / email / phone.
- Payout processing and guest refund processing (including Stripe refunds).

## Getting started

There is no root-level package manager. Each service is installed and run from
its own directory.

### Prerequisites
- Node.js 20+ and npm
- Python 3.10+
- A MongoDB instance (local or Atlas)
- Accounts/keys: Cloudinary, Stripe, and a Gmail app password. Identity
  verification additionally needs Google Cloud Vision and AWS Rekognition
  credentials (the app runs without them, but verification calls will fail).

### 1. Clone

```bash
git clone <your-repo-url> bookvibe
cd bookvibe
```

### 2. Backend (API — http://localhost:3000)

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values (see below)
npm run dev               # runs node index.js (no watch; restart after changes)
```

### 3. Frontend (SPA — http://localhost:5173)

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL and VITE_ADMIN_PATH
npm run dev               # local dev server
# npm run host            # expose on the LAN
# npm run build           # production build
```

### 4. Verification service (http://localhost:5001)

```bash
cd python-verification-service
python -m venv venv
venv\Scripts\activate           # Windows
# source venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
cp .env.example .env             # add AWS + Google credentials
python main.py
```

### Docker (all three services)

A `docker-compose.yml` builds and runs all three behind Nginx for single-host
deployment. See `DOCKER.md` for the full setup, including the Stripe webhook and
AWS EC2 notes.

```bash
cp .env.example .env             # root file — sets the frontend build args
# ensure backend/.env and python-verification-service/.env also exist
docker compose build             # first build is slow
docker compose up -d
```

## Environment variables

Each service has its own `.env.example` — copy it to `.env` and fill it in. Never
commit a real `.env`; the `.gitignore` allows only `*.env.example`.

**`backend/.env`** — MongoDB, JWT secrets and token lifetimes, Cloudinary, the
CORS client allowlist, Gmail credentials, Stripe secret + webhook secret, the
verification service URL and shared key, the admin PIN, and Web Push (VAPID)
keys. Twilio and Redis are optional. See `backend/.env.example` for the full
annotated list.

**`frontend/.env`** — `VITE_API_URL` (must include the `/api/v1` suffix, e.g.
`http://localhost:3000/api/v1`), `VITE_ADMIN_PATH` (the secret admin route
segment), and the AWS region + Cognito Identity Pool used by the browser Face
Liveness widget. See `frontend/.env.example`.

**`python-verification-service/.env`** — AWS credentials + region, the path to a
Google service-account JSON, the CORS allowlist (backend origin only), the shared
`INTERNAL_API_KEY`, and the decision thresholds. See its `.env.example`.

## API overview

All backend routes are mounted under `/api/v1`. The Stripe webhook is mounted
before the JSON body parser because signature verification needs the raw body.
Auth column: **Public** = none; **Auth** = any logged-in user; **Guest / Host /
Admin** = that role; **Admin+PIN** = admin role plus the PIN gate token.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Service health check | Public |
| POST | `/api/v1/user/register-user` | Register a new user | Public |
| POST | `/api/v1/user/send-email-otp` | Send pre-registration email OTP | Public |
| POST | `/api/v1/user/login` | Log in (rate-limited) | Public |
| POST | `/api/v1/user/forgot-password` / `/reset-password/:token` | Password reset | Public |
| POST | `/api/v1/user/refresh` | Rotate the refresh token | Cookie |
| POST | `/api/v1/user/logout` | Log out | Public |
| GET | `/api/v1/user/me` | Current user profile | Auth |
| PUT | `/api/v1/user/update-profile` / `update-password` / `settings` | Update account | Auth |
| GET | `/api/v1/property` | List / search / filter properties | Public |
| GET | `/api/v1/property/:id` | Property detail | Public |
| POST | `/api/v1/property/add-property` | Create a listing | Host |
| PUT / DELETE | `/api/v1/property/:id` | Update / delete a listing | Host |
| PATCH | `/api/v1/property/:id/toggle-availability` | Toggle availability | Host |
| POST | `/api/v1/booking/create-booking` | Create a booking (rate-limited) | Guest/Host |
| POST | `/api/v1/booking/check-availability` | Check date availability | Auth |
| GET | `/api/v1/booking/my-bookings` | Guest's bookings | Guest/Host |
| GET | `/api/v1/booking/:id` | Booking detail | Auth |
| POST | `/api/v1/booking/:id/cancel` / `:id/verify-payment` | Cancel / verify Stripe payment | Guest/Host |
| GET | `/api/v1/booking/host/all-bookings` / `dashboard-stats` / `earnings` | Host booking views | Host |
| PATCH | `/api/v1/booking/host/:id/confirm-cash` / `release-deposit` / `claim-deposit` | Host booking actions | Host |
| GET / PATCH | `/api/v1/booking/admin/all-bookings` / `refunds` / `refund/:id` | Admin booking + refund mgmt | Admin+PIN |
| POST | `/api/v1/verify/cnic-ocr` / `face-match` / `liveness` | Pre-registration KYC previews (rate-limited) | Public |
| POST | `/api/v1/verify/liveness/session` / `session-result` | Face Liveness session lifecycle | Public |
| POST | `/api/v1/verify/kyc/full` / `resubmit` | Full KYC pipeline for a user | Auth |
| POST / GET | `/api/v1/host-payments/payment-info` | Save / read payout details | Host |
| GET | `/api/v1/host-payments/earnings` / `payouts` | Earnings + payout history | Host |
| POST | `/api/v1/host-payments/request-payout` | Request a payout | Host |
| GET / PATCH | `/api/v1/host-payments/admin/payouts` / `payouts/:id` / `verify/:hostId` | Admin payout processing | Admin+PIN |
| POST / GET | `/api/v1/reviews` / `my-reviews` / `property/:id` | Create / list reviews | Mixed |
| POST / GET | `/api/v1/wishlist/toggle` / `my` | Wishlist | Auth |
| POST / GET | `/api/v1/complaints` / `my` / `against-me` | File / view complaints | Auth |
| GET / POST / PUT / DELETE | `/api/v1/foodmenu/*` | Food menu + orders | Mixed |
| POST | `/api/v1/concierge/order-service` / `add-service` | Concierge services | Mixed |
| POST | `/api/v1/emergency/sos` | Trigger emergency SOS | Auth |
| GET / PATCH / DELETE | `/api/v1/notifications/*` | Notifications | Auth |
| GET / POST | `/api/v1/push/vapid-public-key` / `subscribe` / `unsubscribe` | Web Push subscriptions | Auth |
| POST | `/api/v1/user/admin/verify-pin` | Exchange the admin PIN for a gate token | Admin |
| GET | `/api/v1/user/admin/stats` / `analytics` / `all-users` / `all-hosts` | Admin dashboards | Admin+PIN |
| PATCH / DELETE | `/api/v1/user/admin/block/:id` / `verify-host/:id` / `verify-kyc/:id` | Admin moderation | Admin+PIN |
| GET / POST / DELETE | `/api/v1/user/admin/blacklist` | Blacklist management | Admin+PIN |
| POST | `/api/v1/webhook/stripe` | Stripe webhook (raw body, signature-verified) | Stripe |

This is a representative subset; the exact handlers live in `backend/routers/`.

## Project structure

```
bookvibe/
├── backend/                      # Express 5 + Mongoose REST API (ESM)
│   ├── controllers/              # Request handlers
│   ├── models/                   # Mongoose schemas (UserAndHost, Property, Booking, Payout, …)
│   ├── routers/                  # Express routers, mounted under /api/v1
│   ├── services/                 # Stripe, notifications, and other business logic
│   ├── middlewares/              # Auth, admin PIN gate, Cloudinary, email templates
│   ├── utils/                    # Tokens, cron, verification-service client
│   ├── config/                   # DB, Socket.io, Redis
│   └── index.js                  # App entry point + middleware order
│
├── frontend/                     # React 19 + Vite SPA
│   ├── src/
│   │   ├── pages/                # Guest, host/, and admin/ pages (lazy-loaded)
│   │   ├── components/           # Shared UI and providers
│   │   ├── redux/                # Store and slices
│   │   ├── hooks/                # useSocket and others
│   │   └── utils/                # Axios config, pricing, Web Push
│   ├── nginx.conf                # SPA serving + reverse proxy (Docker)
│   └── Dockerfile
│
├── python-verification-service/  # FastAPI: CNIC OCR / face match / liveness
│   ├── main.py                   # Endpoints
│   ├── providers.py              # Google Vision + AWS Rekognition providers
│   └── config.py
│
├── docs/screenshots/             # (screenshots to be added)
├── docker-compose.yml
├── DOCKER.md
└── AWS_FACE_LIVENESS_SETUP.md
```

## Status and known limitations

- **No hosted demo.** The app is only runnable locally or via Docker. Deploying
  it publicly is the single biggest improvement this repo can make.
- **No automated tests.** There is no test suite; the backend `npm test` is a
  failing placeholder. Correctness relies on manual testing.
- **The backend dev server has no file watching.** `npm run dev` is just
  `node index.js`; restart it manually after backend changes.
- **Identity verification depends on paid cloud services.** Without Google Cloud
  Vision and AWS Rekognition credentials configured, CNIC OCR, face matching, and
  liveness calls fail. The rest of the app still works.
- **Passive `liveness-check` is a heuristic, not true anti-spoofing.** The
  robust path is the active AWS Face Liveness challenge; the single-image
  `detect_faces` quality check is a weaker fallback.
- **Escrow is application-level accounting, not a regulated escrow account.**
  Guest payments are held by the platform and paid out after a 10% commission;
  this is bookkeeping in the database, not a licensed financial arrangement.
- **Currency is PKR only**, and the CNIC OCR is tuned specifically to the
  Pakistani national ID format.
- **No license file yet.** This repository does not currently include a LICENSE.
