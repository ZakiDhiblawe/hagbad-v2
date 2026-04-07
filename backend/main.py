from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import register_routes
from database import Base, engine
from utility.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_routes(app)

# # Dev convenience only. Keep FALSE when using Alembic migrations.
# if settings.auto_create_tables:
#     Base.metadata.create_all(bind=engine)
