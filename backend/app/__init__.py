from fastapi import FastAPI

from app.main.routes import router as main_router

def register_routes(app: FastAPI):
    app.include_router(main_router)