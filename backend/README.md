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
