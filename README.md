markdown
# 🏦 Hagbad - Ayuuto Contribution Management System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python)](https://python.org)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

A modern, scalable backend system for managing **Ayuuto** (rotating savings and credit associations) with support for multiple admins, flexible contribution schedules, and automated cycle management.

## 📋 Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Installation](#quick-installation)
- [Detailed Setup Guide](#detailed-setup-guide)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing the API](#testing-the-api)
- [Database Management](#database-management)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Team Collaboration](#team-collaboration)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)

## 🎯 Overview

**Hagbad** (also known as Ayuuto, Rotating Savings and Credit Association - ROSCA) is a community-based savings system where a group of people contribute a fixed amount regularly, and each member takes turns receiving the full pot.

This backend system provides:
- **Multi-admin support** - Multiple users can manage a single group
- **Flexible cycles** - Daily, weekly, monthly, or custom contribution schedules
- **Role-based permissions** - Admins, moderators, and members with different access levels
- **Automated tracking** - Payment verification, late penalties, and payout scheduling
- **Mobile-ready API** - RESTful endpoints designed for mobile app integration

## ✨ Core Features

### ✅ Implemented
| Feature | Status | Description |
|---------|--------|-------------|
| User Registration | ✅ | Email/password registration with validation |
| JWT Authentication | ✅ | Secure token-based authentication |
| PostgreSQL Database | ✅ | Production-ready database with SQLAlchemy ORM |
| Database Migrations | ✅ | Version control for database schema with Alembic |
| API Documentation | ✅ | Auto-generated Swagger UI and ReDoc |
| Password Hashing | ✅ | bcrypt encryption for passwords |
| CORS Support | ✅ | Cross-origin requests for frontend/mobile apps |
| Frontend Pages | ✅ | Basic login/registration interface |

### 🚧 In Development
| Feature | Status | Expected |
|---------|--------|----------|
| Group Management | 🚧 | Next sprint |
| Multiple Admins | 🚧 | Next sprint |
| Contribution Cycles | 🚧 | Sprint 2 |
| Payment Tracking | 🚧 | Sprint 2 |
| Payout Scheduling | 📅 | Sprint 3 |
| Email Notifications | 📅 | Sprint 3 |
| Mobile API | 📅 | Sprint 4 |

## 🛠️ Technology Stack

### Backend
```yaml
Framework: FastAPI 0.115.12
Language: Python 3.12+
Database: PostgreSQL 15+
ORM: SQLAlchemy 2.0.36
Migrations: Alembic 1.14.1
Authentication: JWT (python-jose)
Password Hashing: bcrypt 4.2.0
Server: Uvicorn 0.44.0
Frontend
yaml
HTML5, CSS3, Vanilla JavaScript
Static files served by FastAPI
Development Tools
yaml
Version Control: Git
Environment: python-dotenv
Code Style: Black, Flake8 (optional)
Testing: Pytest (to be implemented)
📋 Prerequisites
Required Software
bash
Python 3.12 or higher      # Check with: python3 --version
PostgreSQL 15 or higher    # Check with: psql --version
Git                        # Check with: git --version
pip (Python package manager)
For Ubuntu/Debian
bash
# Install Python 3.12
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Git
sudo apt install git
For macOS
bash
# Install Homebrew first, then:
brew install python@3.12
brew install postgresql@15
brew install git
For Windows
bash
# Download and install:
Python 3.12: https://python.org/downloads/
PostgreSQL: https://postgresql.org/download/
Git: https://git-scm.com/download/win
🚀 Quick Installation
For new team members - Complete setup in 5 minutes:

bash
# 1. Clone the repository
git clone https://github.com/yourusername/hagbad-v2.git
cd hagbad-v2

# 2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# 4. Setup PostgreSQL database
sudo -u postgres psql << EOF
CREATE DATABASE hagbad_db;
CREATE USER hagbad_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE hagbad_db TO hagbad_user;
\q
EOF

# 5. Configure environment
cp .env.example .env
# Edit .env with your database password

# 6. Run migrations
alembic upgrade head

# 7. Start the server
./run.sh
Open your browser: http://localhost:8000

📝 Detailed Setup Guide
Step 1: Clone Repository
bash
# Clone with HTTPS
git clone https://github.com/yourusername/hagbad-v2.git

# Or with SSH (if configured)
git clone git@github.com:yourusername/hagbad-v2.git

cd hagbad-v2
Step 2: Set Up Virtual Environment
bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate           # Linux/Mac
# OR
venv\Scripts\activate               # Windows
# OR
source venv/Scripts/activate        # Git Bash on Windows

# Verify activation (should show (venv) in terminal)
which python  # Should point to venv directory
Step 3: Install Dependencies
bash
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# Verify installations
pip list | grep -E "fastapi|sqlalchemy|alembic|psycopg2"
Step 4: Configure PostgreSQL Database
Start PostgreSQL Service
bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew services start postgresql@15

# Windows
# PostgreSQL starts automatically as a Windows service
Create Database and User
bash
# Method 1: Using psql
sudo -u postgres psql

# Inside psql prompt:
CREATE DATABASE hagbad_db;
CREATE USER hagbad_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE hagbad_db TO hagbad_user;
ALTER USER hagbad_user CREATEDB;
\q

# Method 2: Using createdb command (Linux/Mac)
sudo -u postgres createdb hagbad_db
sudo -u postgres createuser --pwprompt hagbad_user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hagbad_db TO hagbad_user;"
Verify Database Connection
bash
# Test connection
psql -U hagbad_user -d hagbad_db -h localhost
# Enter password when prompted
# You should see: hagbad_db=>
Step 5: Configure Environment Variables
bash
# Copy example configuration
cp .env.example .env

# Edit .env file
nano .env  # or vim .env, or code .env
Update these values in .env:

bash
# IMPORTANT: Use the password you set in Step 4
POSTGRES_PASSWORD=your_secure_password_here

# Generate a secure SECRET_KEY
# Run this command to generate one:
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output and paste as SECRET_KEY value
Example .env file:

bash
# Database Configuration
POSTGRES_USER=hagbad_user
POSTGRES_PASSWORD=MySecurePass123!
POSTGRES_DB=hagbad_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

DATABASE_URL=postgresql://hagbad_user:MySecurePass123!@localhost:5432/hagbad_db

# Security
SECRET_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Application
APP_NAME=Hagbad API
APP_VERSION=1.0.0
DEBUG=True
BACKEND_CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000"]
Step 6: Run Database Migrations
bash
# Ensure you're in backend directory
cd ~/hagbad-v2/backend

# Create initial migration (first time only)
alembic revision --autogenerate -m "Initial migration"

# Apply migrations to database
alembic upgrade head

# Expected output:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] Will assume transactional DDL.
# INFO  [alembic.runtime.migration] Running upgrade -> xxx, Initial migration

# To verify tables were created:
psql -U hagbad_user -d hagbad_db -c "\dt"
# You should see: users, groups, group_members, cycles
Step 7: Start the Application
bash
# Make run script executable (first time only)
chmod +x run.sh

# Start the server
./run.sh

# Or run directly with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Expected output:

text
INFO:     Will watch for changes in these directories: ['/home/username/hagbad-v2/backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
Default admin created: admin@hagbad.com / Admin123!
Database initialized successfully
INFO:     Application startup complete.
🏃 Running the Application
Development Mode (with auto-reload)
bash
cd ~/hagbad-v2/backend
source ../venv/bin/activate  # Activate virtual environment
./run.sh                      # Start server
Manual Start (without script)
bash
cd ~/hagbad-v2/backend
source ../venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Different Port
bash
# Use port 8080 instead
uvicorn app.main:app --reload --port 8080
Production Mode (without auto-reload)
bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Stop the Server
bash
# Press Ctrl+C in the terminal where server is running
# Or kill the process:
lsof -ti:8000 | xargs kill -9
📚 API Documentation
Once the server is running, access:

Interface	URL	Description
Swagger UI	http://localhost:8000/docs	Interactive API testing interface
ReDoc	http://localhost:8000/redoc	Alternative API documentation
Frontend	http://localhost:8000	Login/Registration pages
Health Check	http://localhost:8000/api/health	Server status endpoint
Available Endpoints
Method	Endpoint	Description	Auth Required
POST	/api/v1/auth/register	Register new user	No
POST	/api/v1/auth/login	Login and get JWT token	No
GET	/api/v1/auth/me	Get current user info	Yes
GET	/api/health	Health check	No
🧪 Testing the API
Using Swagger UI (Easiest)
Open http://localhost:8000/docs

Click on any endpoint

Click "Try it out"

Fill in parameters

Click "Execute"

Using curl Commands
1. Health Check
bash
curl http://localhost:8000/api/health
Response:

json
{
  "status": "healthy",
  "database": "connected"
}
2. Register a New User
bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "phone": "+252612345678",
    "password": "Test123!"
  }'
Expected Response:

json
{
  "id": 1,
  "full_name": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "phone": "+252612345678",
  "role": "member",
  "status": "active",
  "is_active": true,
  "is_verified": true,
  "created_at": "2024-01-15T10:30:00Z"
}
3. Login
bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=ahmed@example.com&password=Test123!"
Expected Response:

json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
4. Get Current User (Authenticated)
bash
# Replace YOUR_TOKEN with the access_token from login response
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
Using Python
python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Register
response = requests.post(f"{BASE_URL}/auth/register", json={
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "Test123!"
})
print(response.json())

# Login
response = requests.post(f"{BASE_URL}/auth/login", data={
    "username": "test@example.com",
    "password": "Test123!"
})
token = response.json()["access_token"]

# Get user info
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
print(response.json())
🗄️ Database Management
Common Database Operations
bash
# Connect to database
psql -U hagbad_user -d hagbad_db -h localhost

# List all tables
\dt

# View users
SELECT id, email, full_name, created_at FROM users;

# Count users
SELECT COUNT(*) FROM users;

# Drop database (reset everything)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS hagbad_db;"
sudo -u postgres psql -c "CREATE DATABASE hagbad_db;"

# Exit psql
\q
Migration Commands
bash
# Create new migration after model changes
alembic revision --autogenerate -m "description_of_changes"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Rollback all migrations
alembic downgrade base

# View migration history
alembic history

# Check current version
alembic current
Backup and Restore
bash
# Backup database
pg_dump -U hagbad_user hagbad_db > hagbad_backup_$(date +%Y%m%d).sql

# Restore database
psql -U hagbad_user -d hagbad_db < hagbad_backup_20240115.sql
