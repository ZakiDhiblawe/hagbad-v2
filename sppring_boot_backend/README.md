# Spring Boot Backend

This folder is a separate Spring Boot backend for Hagbad.

It is meant to run on the same API port as FastAPI, use the same PostgreSQL database, and serve the same uploaded files so the existing frontend can work without frontend changes.

## What this backend covers

These frontend-used routes are now present in `sppring_boot_backend`:

- `GET /`
- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /profile`
- `PUT /profile`
- `PUT /profile/password`
- `GET /groups/`
- `POST /groups/`
- `GET /groups/{id}`
- `PUT /groups/{id}`
- `POST /groups/{id}/join`
- `POST /groups/{id}/close`
- `DELETE /groups/{id}`
- `GET /group-members/`
- `POST /group-members/`
- `PUT /group-members/{id}`
- `DELETE /group-members/{id}`
- `POST /group-members/leave`
- `POST /group-settings/`
- `GET /group-settings/{groupId}`
- `PUT /group-settings/{groupId}`
- `DELETE /group-settings/{groupId}`
- `POST /invites/`
- `GET /invites/{groupId}`
- `POST /invites/redeem`
- `DELETE /invites/{inviteId}`
- `POST /join-requests/`
- `GET /join-requests/mine`
- `GET /join-requests/group/{groupId}`
- `GET /join-requests/managed`
- `GET /join-requests/{id}`
- `POST /join-requests/{id}/decision`
- `DELETE /join-requests/{id}`
- `POST /cycles/`
- `GET /cycles/{id}`
- `GET /cycles/group/{groupId}`
- `PUT /cycles/{id}`
- `PUT /cycles/{id}/start`
- `PUT /cycles/{id}/stop`
- `POST /cycle-members/`
- `POST /cycle-members/fill`
- `GET /cycle-members/`
- `GET /cycle-members/{id}`
- `PUT /cycle-members/{id}`
- `DELETE /cycle-members/{id}`
- `POST /payments/`
- `GET /payments/{id}`
- `GET /payments/`
- `GET /payments/summary/cycle/{cycleId}`
- `PUT /payments/{id}`
- `PUT /payments/{id}/submit`
- `PUT /payments/{id}/approve`
- `DELETE /payments/{id}`
- `POST /payouts/`
- `GET /payouts/{id}`
- `GET /payouts/`
- `GET /payouts/summary/cycle/{cycleId}`
- `PUT /payouts/{id}`
- `PUT /payouts/{id}/approve`
- `PUT /payouts/{id}/reject`
- `PUT /payouts/{id}/pay`
- `DELETE /payouts/{id}`

## Important choices

- Port is `8000` by default so it matches the current frontend expectation.
- The app reads a FastAPI-style `.env`.
- The app points to the same `backend/files` upload folder, so old profile and group images still work.
- Flyway creates missing tables and enum types with safe `IF NOT EXISTS` guards.
- Spring Data JPA / Hibernate ORM is used for the new domain modules such as settings, invites, join requests, cycles, cycle members, payments, and payouts.
- Some earlier compatibility pieces still use the existing repository code while sharing the same schema and API contract.

## If you are new to Java

There is no Python `venv` here.

- Python backend: dependencies go inside `venv`
- Spring Boot backend: dependencies are managed by Maven
- Maven downloads Java libraries into `~/.m2/repository`

Think of Maven as the Java side of dependency management and build tooling.

## Prerequisites

Java 21 is already installed on your WSL.

You still need Maven:

```bash
sudo apt update
sudo apt install -y maven
```

Check it:

```bash
mvn -version
```

## .env file

From the repo root:

```bash
cd /home/ikrm/hagbad-v2/sppring_boot_backend
cp .env.example .env
```

The app auto-loads `.env`, so you do not need `source .env`.

Default example:

```env
DATABASE_URL="postgresql://postgres:admin123@localhost:5432/hagbad"
SECRET_KEY="CHANGE_ME__GENERATE_REAL_SECRET"
AUTO_CREATE_TABLES=false
SERVER_PORT=8000
FILES_DIR="backend/files"
```

What these mean:

- `DATABASE_URL`: same PostgreSQL database used by the old backend
- `SECRET_KEY`: JWT signing key for login tokens
- `SERVER_PORT=8000`: same port the frontend already calls
- `FILES_DIR=backend/files`: same upload folder used by FastAPI

## How to run it

1. Stop the old FastAPI backend first, because both want port `8000`.
2. Go into the Spring Boot folder.
3. Start the app with Maven.

```bash
cd /home/ikrm/hagbad-v2/sppring_boot_backend
mvn spring-boot:run
```

When it starts, the API should be available at:

```text
http://127.0.0.1:8000
```

## Database and old data

This backend is designed to use the same old database and same uploaded files.

That means your old data should stay where it is:

- old users
- old groups
- old group memberships
- old group settings
- old invites
- old join requests
- old cycles
- old cycle members
- old payments
- old payouts
- old uploaded images under `/files/...`

## Migrations

Flyway runs automatically when the app starts.

Current migrations:

- `V1__create_users.sql`
- `V2__create_groups_and_group_members.sql`
- `V3__create_remaining_tables.sql`

These create the missing PostgreSQL enum types and tables for:

- `group_settings`
- `invites`
- `join_requests`
- `cycles`
- `cycle_members`
- `payments`
- `payouts`

Because the SQL uses `IF NOT EXISTS`, it is safe for an existing Hagbad database where the old tables are already there.

## Quick checks

Root:

```bash
curl http://127.0.0.1:8000/
```

Register:

```bash
curl -X POST "http://127.0.0.1:8000/register" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","email":"test@mail.com","password":"12345678"}'
```

Login:

```bash
curl -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@mail.com&password=12345678"
```

Get my profile:

```bash
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@mail.com&password=12345678" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

curl -X GET "http://127.0.0.1:8000/profile" \
  -H "Authorization: Bearer $TOKEN"
```

List my groups:

```bash
curl -X GET "http://127.0.0.1:8000/groups/?mine=true&page=1&size=20" \
  -H "Authorization: Bearer $TOKEN"
```

Start the frontend after the Spring Boot backend is running, and it should keep calling `http://localhost:8000` like before.
