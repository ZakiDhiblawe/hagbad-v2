from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import register_routes
from database import Base, engine
from utility.config import settings

app = FastAPI()
FILES_DIR = Path(__file__).resolve().parent / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_routes(app)
app.mount("/files", StaticFiles(directory=FILES_DIR), name="files")

# # Dev convenience only. Keep FALSE when using Alembic migrations.
# if settings.auto_create_tables:
#     Base.metadata.create_all(bind=engine)
