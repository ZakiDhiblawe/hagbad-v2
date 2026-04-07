from fastapi import FastAPI

from app.main.routes import router as main_router
from app.user.routes import router as user_router
from app.group.routes import router as group_router


def register_routes(app: FastAPI) -> None:
    app.include_router(main_router)
    app.include_router(user_router)
    app.include_router(group_router)
