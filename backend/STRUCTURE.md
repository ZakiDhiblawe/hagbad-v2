markdown
# Hagbad Project Structure Documentation

## 📁 Project Overview

This document explains the purpose of each file and directory in the Hagbad (Ayuuto Management System) backend.

## 🗂️ Directory Structure
backend/
├── alembic/ # Database migration tool configuration
│ ├── versions/ # Migration version files (auto-generated)
│ ├── env.py # Alembic environment configuration
│ └── script.py.mako # Migration script template
│
├── app/ # Main application code
│ ├── api/ # API route handlers
│ │ └── v1/ # API version 1
│ │ └── endpoints/ # Individual endpoint modules
│ │ ├── auth.py # Authentication endpoints
│ │ └── deps.py # Dependencies (auth, DB sessions)
│ │
│ ├── core/ # Core application logic
│ │ ├── config.py # Application configuration (env vars)
│ │ └── security.py # Password hashing, JWT tokens
│ │
│ ├── db/ # Database related files
│ │ ├── base.py # Database connection & session
│ │ └── init_db.py # Database initialization & seed data
│ │
│ ├── models/ # SQLAlchemy ORM models
│ │ ├── user.py # User model (authentication)
│ │ ├── group.py # Group/Ayuuto model
│ │ ├── group_member.py # Group membership & roles
│ │ └── cycle.py # Contribution cycle model
│ │
│ ├── schemas/ # Pydantic models (request/response validation)
│ │ ├── user.py # User schemas
│ │ └── auth.py # Authentication schemas
│ │
│ ├── services/ # Business logic layer (to be implemented)
│ │ └── init.py
│ │
│ ├── main.py # FastAPI application entry point
│ └── init.py # Makes Python treat directory as package
│
├── frontend/ # Static frontend files
│ ├── css/ # Stylesheets
│ ├── js/ # JavaScript files
│ ├── pages/ # HTML pages
│ ├── index.html # Landing page (login/register)
│ └── dashboard.html # User dashboard
│
├── tests/ # Unit and integration tests
│ └── init.py
│
├── alembic.ini # Alembic configuration
├── requirements.txt # Python dependencies
├── run.sh # Application startup script
└── .env # Environment variables (not in git)

text

## 📄 File Descriptions

### Core Configuration Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app initialization, middleware, router registration |
| `config.py` | Loads environment variables, database URLs, security keys |
| `database.py` | SQLAlchemy setup, connection pool, session management |
| `security.py` | Password hashing (bcrypt), JWT token creation/validation |

### Models (Database Tables)

| Model | Table Name | Purpose |
|-------|------------|---------|
| `User` | users | User accounts, authentication, profiles |
| `Group` | groups | Ayuutto groups, settings, contribution rules |
| `GroupMember` | group_members | Member roles (admin/moderator/member) |
| `Cycle` | cycles | Contribution cycles, payment schedules |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/login` | POST | User login (returns JWT) |
| `/api/v1/auth/me` | GET | Get current user profile |

### Frontend Files

| File | Purpose |
|------|---------|
| `index.html` | Login/Registration page |
| `dashboard.html` | User dashboard after login |
| `css/style.css` | Styling for all pages |
| `js/api.js` | API client functions |
| `js/auth.js` | Authentication logic |

## 🔧 Configuration Files

### `alembic.ini`
Database migration configuration. Tells Alembic where to find your database.

### `requirements.txt`
Python package dependencies:
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **asyncpg** - PostgreSQL driver
- **python-jose** - JWT handling
- **passlib** - Password hashing

### `.env` (create locally)
Environment variables (never commit to git):
```env
DATABASE_URL=postgresql://user:pass@localhost/hagbad_db
SECRET_KEY=your-secret-key
DEBUG=True
