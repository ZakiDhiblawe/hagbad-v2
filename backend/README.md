# Backend (FastAPI)

## Setup

### 1. Create virtual environment

```bash
d

python3 -m venv venv
2. Activate venv
source venv/bin/activate
3. Install dependencies
pip install -r requirements.txt

If no requirements file:

sudo apt install libpq-dev python3-dev

pip install fastapi uvicorn sqlalchemy psycopg2
Database (PostgreSQL)

Make sure PostgreSQL is running.

Create database:

CREATE DATABASE hagbad;
Run Server
uvicorn main:app --reload

Server runs at:

http://127.0.0.1:8000
Update Requirements

After installing new packages:

pip freeze > requirements.txt

make secret key 
openssl rand -hex 32


---

# 📄 3. BACKEND STRUCTURE (`backend/STRUCTURE.md`)

```md
# Backend Structure


backend/
├── main.py # App entry point
├── database.py # Database connection
├── utility/
│ └── security.py # Auth (JWT + hashing)
└── app/
├── main/
│ └── routes.py # Base routes (/)
└── user/
├── models.py # User table
├── schemas.py # User schemas
└── routes.py # Auth routes


## Notes

- Each module lives inside `app/`
- Routes are registered via `app/__init__.py`
- Database uses SQLAlchemy
```


## Dependencies (command-driven)

Install packages you need:

```bash
pip install python-multipart passlib[bcrypt] "python-jose[cryptography]" pydantic-settings alembic
Whenever you add a new package, update requirements automatically:

bash
Copy
pip freeze > requirements.txt
Environment (.env)
Create backend/.env:

env
Copy
DATABASE_URL="postgresql://postgres:admin123@localhost:5432/hagbad"
SECRET_KEY="CHANGE_ME__GENERATE_REAL_SECRET"
AUTO_CREATE_TABLES=false
You can also copy `backend/.env.example` as the starting template.

Token expiry is no longer configured in `.env`. Each user can set optional session hours from the profile page. If left blank, the session stays active until logout or until a newer login replaces it.
Generate a strong secret:

bash
Copy
openssl rand -hex 32
Run backend
From backend/:

bash
Copy
source venv/bin/activate
uvicorn main:app --reload
Migrations (Alembic)
Initialise (one time):

bash
Copy
alembic init alembic
Create a migration (after you change models):

bash
Copy
alembic revision --autogenerate -m "your message"
Apply migrations:

bash
Copy
alembic upgrade head
Check current version:

bash
Copy
alembic current
Note: AUTO_CREATE_TABLES should stay false when using Alembic.

pgsql
Copy

## Git hygiene for `.env`

Do **not** commit your secrets. Add `.env` to your `.gitignore`. Using `.env` files is common, but they must be excluded from version control. citeturn3view1  

Add this line to your root `.gitignore`:

```gitignore
.env
Optionally commit a safe backend/.env.example without real secrets.

Quick verification commands
These are the same flows you already use, but included here for completeness.

Register:

bash
Copy
curl -X POST "http://127.0.0.1:8000/register" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","email":"test@mail.com","password":"12345678"}'
Login (OAuth2 password flow uses form fields named username + password, not JSON). 

bash
Copy
curl -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@mail.com&password=12345678"
Profile:

bash
Copy
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@mail.com&password=12345678" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

curl -X GET "http://127.0.0.1:8000/profile" \
  -H "Authorization: Bearer $TOKEN"
