# BookVibe — Frontend

The web client for **BookVibe**, a property-booking platform. Built with **React 19 + Vite 7**, using Redux Toolkit for state, Tailwind CSS v4 for styling, and React Router 7 for routing. It talks to the BookVibe Express API and receives real-time updates over Socket.io.

## Tech stack

- **React 19** + **Vite 7** (SPA)
- **Redux Toolkit** — `auth`, `accommodation`, and `booking` slices
- **Tailwind CSS v4**
- **React Router 7** — lazy-loaded routes with role-based guards (guest / host / admin)
- **Axios** — shared instance with automatic token refresh
- **Socket.io client** — live notifications and events

## Requirements

- Node.js 18+
- The BookVibe backend API running (see `../backend`)

## Setup

```bash
npm install
```

Create a `.env` file in this folder (see `.env.example` at the repo root for the full list):

```env
VITE_API_URL=http://localhost:3000
VITE_ADMIN_PATH=your-secret-admin-path
```

- `VITE_API_URL` — base URL of the backend API.
- `VITE_ADMIN_PATH` — secret URL segment that gates the admin panel. **Never hardcode this.**

> All frontend env vars must be prefixed with `VITE_` to be exposed to the app.

## Scripts

```bash
npm run dev      # start the Vite dev server (http://localhost:5173)
npm run host     # dev server exposed on the local network (vite --host)
npm run build    # production build
npm run preview  # preview the production build locally
npm run lint     # run ESLint
```

## Project structure

```
src/
  pages/        route-level screens (public, guest, host/, admin/)
  components/   reusable UI components
  redux/        store, slices (auth, accommodation, booking)
  hooks/        custom hooks (e.g. useSocket)
  utils/        axios config, socket, helpers
```

## Notes

- API calls go through the shared axios instance in `src/utils/authConfig.js`, which transparently refreshes the access token on `401` and retries the request once.
- Protected routes wait for auth to hydrate before redirecting, to avoid false `/login` flashes.

Part of the BookVibe project — see the repository root for the backend and Python verification service.
