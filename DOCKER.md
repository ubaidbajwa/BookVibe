# BookVibe — Docker & AWS Deployment Guide

This project runs as **three containers** orchestrated by Docker Compose:

| Container | Image | Exposed | Role |
|-----------|-------|---------|------|
| `frontend` | `bookvibe-frontend` (Nginx) | **80** (public) | Serves the React build + reverse-proxies `/api` and `/socket.io` to the backend |
| `backend` | `bookvibe-backend` (Node 20) | internal `3000` | Express API, Socket.io, Stripe webhook |
| `verification` | `bookvibe-verification` (Python 3.11 + DeepFace) | internal `5001` | CNIC OCR / face match / liveness |

MongoDB (Atlas), Cloudinary, Stripe, Gmail, Twilio remain **external** — referenced through env files.

```
Internet ──:80──> Nginx (frontend) ──/api──┐
                                  ──/socket.io──> backend:3000 ──> verification:5001
```

Why not a single image like the tutorial? The Python ML service has a completely
different runtime (TensorFlow/OpenCV), so it must be its own container. The frontend
is served by Nginx (faster for static files than Express and gives us the reverse proxy
for free).

---

## 1. Prerequisites

- Docker + Docker Compose v2 (`docker compose version`).
- Locally on Windows: Docker Desktop.
- On AWS: an EC2 instance (Ubuntu 22.04, **t3.large or bigger** — the ML image needs RAM).

---

## 2. Environment files

Three env files drive the stack. **None are baked into images** — they're injected at runtime.

### a) `backend/.env` (already exists — review for production)
Set these for a real deployment:
```
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-domain.com        # exact origin you browse the site from
MONGO_URL=...                              # your Atlas URI
STRIPE_WEBHOOK_SECRET=whsec_...            # from the Stripe dashboard endpoint below
# PYTHON_VERIFY_URL is overridden by compose → http://verification:5001 (leave as-is)
```
> `CLIENT_URL` **must** match how you reach the site, or CORS/Socket.io will reject it.
> Local Docker test → `http://localhost`. Production → `https://your-domain.com`.

### b) `python-verification-service/.env` (already exists)
Leave `USE_MOCK_PROVIDERS=True` for testing, or add Google Vision / AWS Rekognition creds for real OCR.
```
ALLOWED_ORIGINS=http://backend:3000,http://localhost:3000
```

### c) `.env` at the project root (CREATE THIS — used by compose for the frontend build)
```
cp .env.example .env
```
Then set the secret admin path segment:
```
VITE_ADMIN_PATH=ctrl-bv5ap6
```

---

## 3. Build & run locally

```bash
# from the project root (where docker-compose.yml lives)
docker compose build          # first build is slow — the Python/TensorFlow image is large
docker compose up -d          # start detached
docker compose ps             # all three should be "running"/"healthy"
docker compose logs -f        # watch startup
```

Open **http://localhost** — the SPA loads, API calls go to `/api/v1`, sockets to `/socket.io`.

> For local testing set `backend/.env` → `CLIENT_URL=http://localhost` so Socket.io accepts the origin.

Stop with:
```bash
docker compose down           # add -v to also wipe the deepface_weights volume
```

---

## 4. Deploy to AWS EC2

1. **Launch EC2** (Ubuntu 22.04, t3.large, 30 GB disk). Security group inbound: `22`, `80`, `443`.
2. **Install Docker:**
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER && newgrp docker
   ```
3. **Get the code** (git clone, or `scp` the project up).
4. **Create the env files** on the server (`backend/.env`, `python-verification-service/.env`, root `.env`) — never commit secrets.
5. **Build & run:**
   ```bash
   docker compose build
   docker compose up -d
   ```
6. Point your domain's DNS **A record** at the EC2 public IP.

### Stripe webhook
In the Stripe dashboard add an endpoint:
```
https://your-domain.com/api/v1/webhook/stripe
```
Copy its signing secret into `backend/.env` → `STRIPE_WEBHOOK_SECRET`, then `docker compose up -d` again.

### HTTPS / TLS (recommended)
Easiest path: run Caddy or an `nginx + certbot` container in front, **or** terminate TLS at an
AWS Application Load Balancer. Minimal in-stack option — add a certbot companion and a `443`
server block to `frontend/nginx.conf`, then uncomment the `443:443` port in `docker-compose.yml`.

---

## 5. Common operations

```bash
docker compose build backend && docker compose up -d backend   # redeploy one service
docker compose logs -f backend                                 # tail one service
docker compose exec backend sh                                 # shell into a container
docker compose down && docker compose up -d --build            # full rebuild
```

> The backend has **no nodemon** — after editing backend code you must rebuild its image.

---

## 6. Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `502 Bad Gateway` on `/api` | Backend not up yet or crashed → `docker compose logs backend`. |
| CORS / Socket.io blocked | `CLIENT_URL` (backend/.env) doesn't match the origin you're browsing from. |
| Admin route 404s | Root `.env` `VITE_ADMIN_PATH` was empty at **build** time → rebuild the frontend. |
| Stripe webhook 400 | Wrong `STRIPE_WEBHOOK_SECRET`, or a body parser ran before the raw route (don't reorder `index.js`). |
| KYC always "unreachable" | `verification` container down, or first request still downloading DeepFace weights. |
| Uploads fail >X MB | `client_max_body_size` in `nginx.conf` must be ≥ the 50 MB express-fileupload limit. |
| Frontend env changed but no effect | `VITE_*` is inlined at build time — rebuild the `frontend` image, not just restart. |
```
