# Hagbad System

Hagbad is a group savings platform (Ayuuto / ROSCA) with two frontend options and two compatible backend implementations.

## Project Structure

```text
hagbad-v2/
├── backend/               FastAPI backend
├── react_frontend/        React + Vite frontend
├── sppring_boot_backend/  Spring Boot backend
└── frontend/              Static HTML/CSS/JS frontend
```

## How It Works

- Both frontends call one shared REST API contract.
- `backend/` and `sppring_boot_backend/` are intended to expose the same endpoints and the same `/files/**` upload paths.
- Run one backend at a time for local development.
- The frontend can point to either backend through `frontend/js/config.local.js`, or use same-origin deployment with `apiBaseUrl: ""`.

## Main Modules

- Users and authentication
- Groups and memberships
- Group settings
- Invites and join requests
- Cycles and cycle members
- Payments and payouts

## Run Project

### 1. Choose a backend

- FastAPI: see `backend/README.md`
- Spring Boot: see `sppring_boot_backend/README.md`

Both are meant to serve the same frontend-facing API.

### 2. Run the frontend

- Static HTML frontend: see `frontend/README.md`
- React frontend: see `react_frontend/README.md`
