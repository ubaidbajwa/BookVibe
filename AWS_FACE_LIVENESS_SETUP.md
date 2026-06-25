# AWS Face Liveness — Setup Guide

BookVibe uses **Amazon Rekognition Face Liveness** for true, active liveness
detection during identity verification (signup + re-verification). The user
performs a short live video challenge in the browser; AWS confirms a real,
present person (not a photo/video/mask) and returns a confidence score plus a
captured **reference frame**, which BookVibe uses as the selfie for face-matching
against the CNIC.

This guide sets up everything AWS-side. Budget ~20 minutes.

---

## How it fits together

```
Browser (Amplify FaceLivenessDetector)
   │  1. asks backend for a session
   │  2. streams the live video challenge ───────────────► Amazon Rekognition
   │       (needs temporary AWS creds from Cognito)
   ▼
Node backend  ──►  Python service (boto3)
   • POST /verify/liveness/session         → CreateFaceLivenessSession
   • POST /verify/liveness/session-result  → GetFaceLivenessSessionResults
                                             (returns confidence + live frame)
```

Two different AWS credential paths are involved:
- **Browser → Rekognition streaming**: temporary creds from a **Cognito Identity Pool** (guest access).
- **Backend → Rekognition Create/Get session**: your existing **IAM access keys** in `python-verification-service/.env`.

---

## Prerequisites

- An AWS account with billing enabled (Face Liveness is **not** free — see Cost).
- Face Liveness is only available in some regions. Pick one and use it everywhere:
  **us-east-1, us-west-2, eu-west-1, eu-central-1, ap-northeast-1, ap-south-1, ap-southeast-1, ap-southeast-2** (verify the current list in the AWS docs).

> Use the **same region** for the Identity Pool, your IAM user, and the
> `AWS_REGION` in the Python service.

---

## Step 1 — IAM permissions for the backend (server-side)

The Python service already uses `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
for face-match. Attach (or confirm) a policy on that IAM user allowing the
liveness session APIs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults",
        "rekognition:CompareFaces",
        "rekognition:DetectFaces"
      ],
      "Resource": "*"
    }
  ]
}
```

Set the region in `python-verification-service/.env`:
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1          # a Face-Liveness-supported region
```

## Step 2 — Cognito Identity Pool for the browser

The browser needs temporary AWS credentials to stream the challenge. Create a
**Cognito Identity Pool** with guest (unauthenticated) access:

1. AWS Console → **Cognito** → **Identity pools** → **Create identity pool**.
2. Choose **Guest access** (no user directory needed — BookVibe creates the
   session server-side, so the browser only needs streaming credentials).
3. Give it a name, e.g. `bookvibe-liveness`.
4. For the **unauthenticated (guest) role**, attach this policy (create a new
   role or edit the one Cognito generates):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rekognition:StartFaceLivenessSession",
      "Resource": "*"
    }
  ]
}
```

5. Create the pool and copy the **Identity pool ID** — it looks like
   `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (the region prefix matters).

> Security note: `StartFaceLivenessSession` is the only permission the guest
> role needs. It cannot create sessions or read results — those happen
> server-side with your IAM user. Without a valid `sessionId` (issued by your
> backend) the streaming call is useless, so guest access here is low-risk.

## Step 3 — Frontend env vars

Set these for the build (Vite inlines them at **build time**):

| Var | Value |
|-----|-------|
| `VITE_AWS_REGION` | your Face-Liveness region, e.g. `us-east-1` |
| `VITE_COGNITO_IDENTITY_POOL_ID` | the pool id from Step 2 |

- **Local dev**: `frontend/.env`
- **Docker/EC2**: the root `.env` (consumed by `docker-compose.yml` as build args)

Leaving `VITE_COGNITO_IDENTITY_POOL_ID` blank disables liveness gracefully —
the widget shows a "not configured" message instead of crashing.

---

## Step 4 — Test

1. Set all env vars, rebuild the frontend (`npm run build` or `docker compose build frontend`).
2. Start signup → reach the **Live Selfie** step. The FaceLivenessDetector
   should open the camera and run the oval challenge.
3. On success the selfie shows a green **"Live verified (NN%)"** badge.

---

## Cost & limits

- Face Liveness is billed **per check** (see the Amazon Rekognition pricing
  page for your region). There is a limited free tier for the first months.
- Each session is single-use and expires (a few minutes) if not completed.
- For a tighter/looser gate, change `LIVENESS_CONFIDENCE_THRESHOLD` in
  `python-verification-service/providers.py` (default `80.0`).

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Widget says "not configured" | `VITE_COGNITO_IDENTITY_POOL_ID` empty at build time → rebuild frontend |
| "Could not start liveness session" (502/503) | Backend IAM user missing `CreateFaceLivenessSession`, or `AWS_REGION` unsupported |
| Camera opens but stream fails | Guest role missing `StartFaceLivenessSession`, or region mismatch between pool and detector |
| Always "not live" | Poor lighting, or confidence below threshold — retry; adjust threshold if needed |
