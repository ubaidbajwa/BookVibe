<div align="center">

# 🏨 BookVibe

### A Full-Stack Property Booking Platform with AI-Powered Identity Verification

*Discover, book, and manage premium stays across Pakistan — with secure escrow payments, real-time notifications, and Pakistani CNIC-based KYC verification.*

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?logo=mongodb&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)
![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?logo=stripe&logoColor=white)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

---

## 📖 Overview

**BookVibe** is a production-grade, full-stack property-booking platform built as a Final Year Project. It connects **guests** looking for short- and long-term stays with **hosts** listing rooms, apartments, houses, hotels, and hostels — backed by a complete **escrow payment system**, an **AI-powered identity-verification pipeline** for Pakistani CNICs, and a comprehensive **admin control panel**.

The platform is composed of **three independent services** that communicate over HTTP and WebSockets:

| Service | Stack | Responsibility |
|---------|-------|----------------|
| **Backend API** | Express 5 · Mongoose 8 · Socket.io · Stripe | REST API, auth, payments, real-time events, business logic |
| **Frontend SPA** | React 19 · Vite 7 · Redux Toolkit · Tailwind CSS v4 | Guest, host, and admin user interfaces |
| **Verification Service** | FastAPI (Python) | CNIC OCR, face matching, and liveness detection |

---

## ✨ Key Features

### 👤 For Guests
- **Smart property discovery** — search and filter by city, type, stay duration, and price range, with category browsing and geolocation-based "near you" suggestions.
- **Smart pricing tiers** — automatic nightly / weekly / monthly rate selection with savings highlighted.
- **Flexible booking** — choose **Pay on Arrival (cash)** or **Stripe card payment**, add concierge services and a pre-ordered meal plan, and review a transparent cost breakdown.
- **Identity verification** — secure CNIC + selfie KYC powered by OCR, face matching, and liveness detection.
- **Reviews, wishlists & comparisons** — leave verified-stay reviews, save favourites, and compare up to 3 properties side-by-side.
- **In-stay services** — order food, request concierge services, and trigger an **Emergency SOS** that instantly alerts the host.
- **Complaints & support** — file complaints with evidence and chat with both the other party and an admin.

### 🏠 For Hosts
- **Listing management** — create and manage single- and multi-unit properties (hotels/hostels with individual rooms), house rules, cancellation policies, and damage deposits.
- **Earnings dashboard** — visualise monthly revenue, bookings, and net take-home after the platform commission.
- **Escrow payouts** — register bank / Easypaisa / JazzCash details, get verified by an admin, and request payouts.
- **Booking & guest management** — confirm cash payments, manage refunds, and view guest identity snapshots.
- **Concierge & food menus** — offer add-on services and per-property food menus.

### 🛡️ For Admins
- **Two-factor admin panel** — a secret admin path **plus a server-enforced 6-digit PIN gate**.
- **KYC review queue** — manually approve or reject identity verifications.
- **User & host management** — block, unblock, or remove users and verify hosts.
- **Payout & refund processing** — approve host payouts and process guest refunds (with Stripe integration).
- **Complaint resolution** — mediate disputes, issue warnings, and **blacklist** offenders by CNIC / email / phone.
- **Analytics dashboard** — platform-wide revenue, growth, and activity metrics.

---

## 🏗️ Architecture Highlights

- **Escrow + commission model** — guest payments are held by the platform; a **10% commission** is deducted at payout time. Failed/abandoned Stripe checkouts are auto-released so dates never get stuck.
- **Dual-token authentication** — short-lived access tokens (15 min) + long-lived refresh tokens (7 days, stored as SHA-256 hashes) with transparent silent refresh.
- **Secure payments** — Stripe Checkout with **signature-verified webhooks**, atomic idempotency, and a server-side verification fallback. Prices are **always recomputed server-side** — the client can never set its own total.
- **Real-time everything** — Socket.io rooms per user/host/admin deliver live notifications, plus **Web Push** (VAPID) for delivery even when the site is closed.
- **AI identity verification** — the FastAPI microservice extracts CNIC fields (number, name, father's name, gender, DOB, address) via **Google Cloud Vision**, matches the face against the CNIC photo via **AWS Rekognition**, and runs **Amazon Rekognition Face Liveness** (an interactive video challenge — the verified-live frame becomes the selfie that's matched to the CNIC), feeding a **trust score**.
- **Trust & safety** — risk-based security deposits, a permanent blacklist, and host/guest CNIC snapshots captured at booking time.

---

## 🧰 Tech Stack

**Frontend**
- React 19 · Vite 7 · React Router 7
- Redux Toolkit (auth, accommodation, booking slices)
- Tailwind CSS v4 · Lucide icons · Leaflet maps
- Axios (shared instance with auto token-refresh) · Socket.io client

**Backend**
- Node.js · Express 5 (ESM) · Mongoose 8 (MongoDB)
- Socket.io · Stripe · Cloudinary (image storage)
- JWT auth · Nodemailer (transactional email) · Web Push · Twilio (SMS)

**Verification Microservice**
- Python · FastAPI · OCR / face-recognition / liveness pipeline

---

## 🚀 Getting Started

> There is no root-level package manager — each service is run from its own directory.

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- A MongoDB instance (local or Atlas)
- Accounts/keys for Stripe, Cloudinary, and Gmail (app password)

### 1️⃣ Backend (API — port `3000`)
```bash
cd backend
npm install
# create a .env file (see "Environment Variables" below)
npm run dev          # node index.js
```

### 2️⃣ Frontend (SPA — port `5173`)
```bash
cd frontend
npm install
# create a .env file with VITE_API_URL and VITE_ADMIN_PATH
npm run dev          # local
npm run host         # expose on LAN
npm run build        # production build
```

### 3️⃣ Verification Service (port `5001`)
```bash
cd python-verification-service
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python main.py
```

---

## 🔑 Environment Variables

**`backend/.env`**
```env
PORT=3000
NODE_ENV=development
MONGO_URL=your_mongodb_connection_string

# Auth
ACCESS_TOKEN_SECRET_KEY=...
REFRESH_TOKEN_SECRET_KEY=...
JWT_SECRET_KEY=...
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Cloudinary (image uploads)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Clients (CORS allowlist)
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173

# Email (Gmail app password)
MY_EMAIL=...
EMAIL_APP_PASSWORD=...

# Payments
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Identity verification microservice
PYTHON_VERIFY_URL=http://localhost:5001

# Admin & Web Push
ADMIN_PIN=000000
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_ADMIN_PATH=your-secret-admin-path

# AWS Face Liveness (browser) — see AWS_FACE_LIVENESS_SETUP.md
VITE_AWS_REGION=us-east-1
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 🐳 Docker Deployment

All three services are containerized and orchestrated with **Docker Compose** for single-host (e.g. AWS EC2) deployment. **Nginx** serves the React build and reverse-proxies `/api` and `/socket.io` to the backend, so the whole stack runs behind a single port.

```
Internet ──:80──> Nginx (frontend) ──/api──────────┐
                                   ──/socket.io──> backend:3000 ──> verification:5001
```

| Container | Image | Role |
|-----------|-------|------|
| `frontend` | Nginx | Serves the SPA + reverse-proxies the backend |
| `backend` | Node 20 | REST API, Socket.io, Stripe webhook |
| `verification` | Python 3.11 + FastAPI | CNIC OCR / face match / liveness |

MongoDB (Atlas), Cloudinary, and Stripe remain external services.

```bash
# from the project root
cp .env.example .env          # set VITE_ADMIN_PATH (frontend build arg)
# ensure backend/.env and python-verification-service/.env exist

docker compose build          # first build is slow (Python/TensorFlow image)
docker compose up -d          # start the full stack
docker compose logs -f        # tail logs
```

Open **http://localhost** (or your server's IP). For production env values, the Stripe webhook setup, HTTPS/TLS, and full AWS EC2 steps, see **[`DOCKER.md`](./DOCKER.md)**.

---

## 📂 Project Structure

```
BookVibe/
├── backend/                    # Express 5 + Mongoose REST API
│   ├── controllers/            # Route handlers (booking, user, admin, payments…)
│   ├── models/                 # Mongoose schemas
│   ├── routers/                # Express routers (mounted under /api/v1)
│   ├── services/               # Business logic (booking, payment, notifications)
│   ├── middlewares/            # Auth, admin gate, Cloudinary, email templates
│   ├── config/                 # Socket.io & Redis setup
│   ├── Dockerfile              # Backend container image
│   └── index.js                # App entry point
│
├── frontend/                   # React 19 + Vite SPA
│   ├── Dockerfile              # Multi-stage build → served by Nginx
│   ├── nginx.conf              # SPA + reverse proxy to the backend
│   └── src/
│       ├── pages/              # Guest, host/, and admin/ pages
│       ├── components/         # Shared UI + providers
│       ├── redux/              # Store & slices
│       ├── hooks/              # useSocket and others
│       └── utils/              # Axios config, pricing, helpers
│
├── python-verification-service/  # FastAPI CNIC OCR / face match / liveness
│   └── Dockerfile              # Verification service container image
│
├── docker-compose.yml          # Orchestrates all three services
└── DOCKER.md                   # Docker & AWS deployment guide
```

---

## 💳 Payment & Escrow Flow

1. Guest selects **Stripe** at checkout → backend creates a Stripe Checkout Session (PKR) and returns the session URL.
2. On success, Stripe fires a **signature-verified webhook** → the booking is marked **paid / confirmed** and both parties are notified in real time.
3. The guest's payment is **held in escrow** by the platform.
4. The host registers payout details → an admin verifies them → the host requests a payout of `net earnings − already paid` (minimum PKR 500).
5. A **10% platform commission** is deducted; the admin marks the payout **completed** with a transaction reference.
6. **Cash ("Pay on Arrival")** is an alternative path the host confirms manually.

---

## 🔒 Security

- Server-side price recomputation on every booking (no client-trusted totals).
- IDOR-safe ownership checks on every guest/host/admin action.
- Stripe webhook signature verification + idempotency.
- Dual-token auth with hashed, rotating refresh tokens.
- **Server-enforced admin PIN gate** as a true second factor (not just a UI redirect).
- Constant-time admin PIN comparison and per-endpoint role authorization.

---

<div align="center">

*Built as a Final Year Project — a complete, real-world full-stack application.*

</div>
