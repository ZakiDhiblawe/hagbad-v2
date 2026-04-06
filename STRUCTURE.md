📁 Project Structure
See PROJECT_STRUCTURE.md for complete file-by-file documentation.

text
hagbad-v2/
├── backend/                    # Backend application
│   ├── app/                    # Main application code
│   │   ├── api/v1/endpoints/  # API route handlers
│   │   ├── core/              # Config & security
│   │   ├── db/                # Database setup
│   │   ├── models/            # Database models
│   │   ├── schemas/           # Request/response schemas
│   │   └── main.py            # FastAPI app entry
│   ├── frontend/              # Static frontend files
│   ├── alembic/               # Migration scripts
│   ├── tests/                 # Test files
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables
│   └── run.sh                 # Startup script
├── venv/                      # Python virtual environment
├── README.md                  # This file
├── PROJECT_STRUCTURE.md       # Detailed structure docs
└── .gitignore                 # Git ignore rules
👨‍💻 Development Workflow
Daily Development Cycle
bash
# 1. Start of day - pull latest changes
cd ~/hagbad-v2
git pull origin main

# 2. Activate virtual environment
source venv/bin/activate

# 3. Start development server
cd backend
./run.sh

# 4. Make changes and test at http://localhost:8000

# 5. End of day - commit changes
git add .
git commit -m "Description of changes"
git push origin main
Creating a New Feature
bash
# 1. Create feature branch
git checkout -b feature/group-management

# 2. Make changes to code

# 3. Run migrations if you changed models
alembic revision --autogenerate -m "add group tables"
alembic upgrade head

# 4. Test your changes

# 5. Commit and push
git add .
git commit -m "Add group management feature"
git push origin feature/group-management

# 6. Create Pull Request on GitHub
Adding a New API Endpoint
Create schema in app/schemas/

Create model in app/models/ (if needed)

Add endpoint in app/api/v1/endpoints/

Test with Swagger UI

Update documentation

🐛 Troubleshooting
Common Issues and Solutions
Issue 1: ModuleNotFoundError
bash
Error: ModuleNotFoundError: No module named 'fastapi'

Solution:
pip install -r requirements.txt
# Make sure virtual environment is activated
Issue 2: Database Connection Failed
bash
Error: psycopg2.OperationalError: could not connect to server

Solutions:
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Verify credentials in .env file
cat .env | grep POSTGRES_PASSWORD

# Test connection manually
psql -U hagbad_user -d hagbad_db -h localhost
Issue 3: Port Already in Use
bash
Error: [Errno 98] Address already in use

Solutions:
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
Issue 4: Migration Errors
bash
Error: Target database is not up to date

Solutions:
# Reset migrations
alembic downgrade base
alembic upgrade head

# If that fails, drop and recreate database
# (Backup first if needed)
sudo -u postgres psql -c "DROP DATABASE hagbad_db;"
sudo -u postgres psql -c "CREATE DATABASE hagbad_db;"
alembic upgrade head
Issue 5: Virtual Environment Not Working
bash
# Recreate virtual environment
deactivate  # Exit current venv
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
Issue 6: bcrypt Version Warning
bash
Warning: (trapped) error reading bcrypt version

Solution: This warning is harmless. To suppress:
pip uninstall bcrypt
pip install bcrypt==4.0.1
Issue 7: Registration Returns 422 Error
bash
Error: 422 Unprocessable Entity

Solutions:
# Check password requirements:
- Minimum 6 characters
- At least 1 uppercase letter
- At least 1 number

# Check email format
# Ensure all required fields are provided
Getting Help
Check logs: Look at terminal output where server is running

API Docs: http://localhost:8000/docs shows expected request formats

Database: Check if tables exist with psql -d hagbad_db -c "\dt"

Environment: Verify .env file has correct values

👥 Team Collaboration
For New Team Members
bash
# Complete setup script (copy and run)
git clone <repo-url> hagbad-v2
cd hagbad-v2
python3 -m venv venv
source venv/bin/activate
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database password
# Create database (ask team lead for credentials)
alembic upgrade head
./run.sh
Git Workflow
bash
# Never commit directly to main
git checkout -b feature/your-feature-name

# Commit regularly with meaningful messages
git commit -m "Add: user profile update endpoint"
git commit -m "Fix: registration validation error"
git commit -m "Docs: update API documentation"

# Pull latest before pushing
git pull origin main --rebase

# Push your branch
git push origin feature/your-feature-name

# Create Pull Request on GitHub
Code Review Checklist
Code follows PEP 8 style

Includes type hints

Has docstrings for functions

Updates relevant documentation

Adds tests for new features

No print statements left in code

Removes commented code

🚢 Deployment
Production Environment Setup
bash
# 1. Clone on production server
git clone <repo-url> /var/www/hagbad
cd /var/www/hagbad

# 2. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# 3. Configure production .env
cd backend
# Set DEBUG=False
# Use strong SECRET_KEY
# Use production database credentials

# 4. Run migrations
alembic upgrade head

# 5. Setup process manager (using systemd)
sudo nano /etc/systemd/system/hagbad.service
Systemd Service File:

ini
[Unit]
Description=Hagbad API Service
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/hagbad/backend
Environment="PATH=/var/www/hagbad/venv/bin"
ExecStart=/var/www/hagbad/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
bash
# Start service
sudo systemctl start hagbad
sudo systemctl enable hagbad
sudo systemctl status hagbad
Using Gunicorn (Production)
bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile -
Nginx Reverse Proxy (Optional)
nginx
server {
    listen 80;
    server_name api.hagbad.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
🔒 Security
Best Practices
Never commit .env file - It's in .gitignore

Use strong passwords - Minimum 12 characters with special chars

Rotate SECRET_KEY - Change periodically

Use HTTPS in production - Never send tokens over HTTP

Rate limiting - Implement for production

Input validation - Already handled by Pydantic

SQL injection protection - SQLAlchemy handles this

Security Checklist for Production
Set DEBUG=False in .env

Use strong SECRET_KEY (32+ random chars)

Enable HTTPS/SSL

Set ACCESS_TOKEN_EXPIRE_MINUTES=15

Configure CORS properly (specific origins, not *)

Use database with strong password

Regular security updates

Backup database regularly

🗺️ Roadmap
Phase 1: Core Features (Current)
User authentication

Database setup

API documentation

Basic frontend

Phase 2: Group Management (Next)
Create/update groups

Invite members

Multiple admin support

Role management

Phase 3: Cycle Management
Start contribution cycles

Payment tracking

Payout scheduling

Late payment handling

Phase 4: Advanced Features
Email notifications

Mobile app API

Admin dashboard

Payment gateway integration

Analytics and reports

📞 Support & Resources
Documentation: See PROJECT_STRUCTURE.md

API Testing: http://localhost:8000/docs

Issues: Create GitHub issue

Email: your-email@example.com

📄 License
Proprietary - All rights reserved. This project is confidential and not for public distribution.

Built with ❤️ for the Hagbad community

Last Updated: January 2026
Version: 1.0.0

text

## 2. Project Structure README - Technical Documentation

**`/home/ikrm/hagbad-v2/PROJECT_STRUCTURE.md`**:

```markdown
# 📁 Hagbad Project - Complete Structure Documentation

## Table of Contents
- [Directory Tree](#directory-tree)
- [Root Directory](#root-directory)
- [Backend Directory](#backend-directory)
- [App Directory Details](#app-directory-details)
- [Frontend Directory](#frontend-directory)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Configuration Files](#configuration-files)
- [File Purposes](#file-purposes)

## 🌳 Directory Tree
hagbad-v2/
│
├── backend/ # Main backend application
│ ├── app/ # Application source code
│ │ ├── api/ # API layer
│ │ │ └── v1/ # API version 1
│ │ │ ├── endpoints/ # Route handlers
│ │ │ │ ├── init.py
│ │ │ │ ├── auth.py # Authentication endpoints
│ │ │ │ └── deps.py # Dependencies (auth, db)
│ │ │ └── init.py
│ │ │
│ │ ├── core/ # Core functionality
│ │ │ ├── init.py
│ │ │ ├── config.py # App configuration
│ │ │ └── security.py # Password hashing, JWT
│ │ │
│ │ ├── db/ # Database layer
│ │ │ ├── init.py
│ │ │ ├── base.py # DB connection & session
│ │ │ └── init_db.py # DB initialization & seeds
│ │ │
│ │ ├── models/ # SQLAlchemy ORM models
│ │ │ ├── init.py
│ │ │ ├── user.py # User model
│ │ │ ├── group.py # Group model
│ │ │ ├── group_member.py # Membership model
│ │ │ └── cycle.py # Cycle model
│ │ │
│ │ ├── schemas/ # Pydantic schemas
│ │ │ ├── init.py
│ │ │ ├── user.py # User request/response
│ │ │ └── auth.py # Auth schemas
│ │ │
│ │ ├── services/ # Business logic (future)
│ │ │ └── init.py
│ │ │
│ │ ├── init.py # Package marker
│ │ └── main.py # FastAPI application entry
│ │
│ ├── frontend/ # Static frontend files
│ │ ├── css/ # Stylesheets
│ │ │ └── style.css
│ │ ├── js/ # JavaScript files
│ │ │ ├── api.js
│ │ │ └── auth.js
│ │ ├── pages/ # HTML pages
│ │ ├── index.html # Login/Register page
│ │ └── dashboard.html # User dashboard
│ │
│ ├── alembic/ # Database migrations
│ │ ├── versions/ # Migration version files
│ │ ├── env.py # Alembic environment
│ │ └── script.py.mako # Migration template
│ │
│ ├── tests/ # Unit tests
│ │ └── init.py
│ │
│ ├── alembic.ini # Alembic configuration
│ ├── requirements.txt # Python dependencies
│ ├── .env # Environment variables
│ ├── .env.example # Example environment file
│ └── run.sh # Startup script
│
├── venv/ # Python virtual environment
├── README.md # Main documentation
├── PROJECT_STRUCTURE.md # This file
└── .gitignore # Git ignore rules

text

## 📂 Root Directory

| File/Directory | Purpose | Critical |
|----------------|---------|----------|
| `backend/` | Main application code | ✅ Yes |
| `venv/` | Python virtual environment (not in git) | ❌ No |
| `README.md` | User documentation | ✅ Yes |
| `PROJECT_STRUCTURE.md` | Technical documentation | ✅ Yes |
| `.gitignore` | Git ignore patterns | ✅ Yes |

## 🗂️ Backend Directory

### Core Files

| File | Purpose | Content |
|------|---------|---------|
| `requirements.txt` | Python package dependencies | List of all pip packages |
| `alembic.ini` | Database migration config | Connection settings for Alembic |
| `.env` | Environment variables | Database URLs, secrets (not in git) |
| `.env.example` | Example environment | Template for .env file |
| `run.sh` | Startup script | Activates venv and runs server |

### Requirements.txt Details

```txt
# Web Framework
fastapi==0.115.12          # Main web framework
uvicorn[standard]==0.44.0  # ASGI server

# Database
sqlalchemy==2.0.36         # ORM
asyncpg==0.30.0            # PostgreSQL driver
alembic==1.14.1            # Migrations
psycopg2-binary==2.9.10    # PostgreSQL adapter

# Authentication
python-jose[cryptography]==3.3.0  # JWT handling
passlib[bcrypt]==1.7.4            # Password hashing
bcrypt==4.2.0                     # Hashing algorithm

# Validation
python-multipart==0.0.20          # Form data parsing
email-validator==2.2.0            # Email validation
pydantic[email]==2.10.4           # Data validation
pydantic-settings==2.7.0          # Settings management

# Utilities
python-dotenv==1.0.1              # Environment variables
📁 App Directory Details
API Layer (app/api/)
api/v1/endpoints/auth.py
Purpose: Authentication and user management endpoints

Functions:

python
register()      # POST /api/v1/auth/register - Create new user
login()         # POST /api/v1/auth/login - Authenticate user
get_current_user_info()  # GET /api/v1/auth/me - Get user profile
Dependencies:

Database session

Password hashing utilities

JWT token creation

api/v1/endpoints/deps.py
Purpose: Common dependencies for endpoints

Functions:

python
get_current_user()  # Extract user from JWT token
# More dependencies will be added (rate limiting, etc.)
Core Layer (app/core/)
core/config.py
Purpose: Application configuration management

Key Variables:

python
DATABASE_URL        # PostgreSQL connection string
SECRET_KEY          # JWT signing key
ALGORITHM           # JWT algorithm (HS256)
ACCESS_TOKEN_EXPIRE_MINUTES  # Token lifetime
DEBUG               # Debug mode flag
API_V1_STR          # API prefix (/api/v1)
BACKEND_CORS_ORIGINS  # Allowed CORS origins
core/security.py
Purpose: Security utilities

Functions:

python
create_access_token()    # Generate JWT token
verify_password()        # Check password against hash
get_password_hash()      # Hash password with bcrypt
decode_token()          # Validate and decode JWT
Database Layer (app/db/)
db/base.py
Purpose: Database connection setup

Components:

python
engine = create_engine()      # SQLAlchemy engine
SessionLocal = sessionmaker() # Session factory
Base = declarative_base()     # Base model class
get_db()                      # Dependency for DB sessions
Connection Pool Settings:

pool_size=10 - Maximum connections

max_overflow=20 - Extra connections allowed

pool_pre_ping=True - Check connection before using
