from fastapi import FastAPI

from app.main.routes import router as main_router
from app.user.routes import router as user_router
from app.group.routes import router as group_router
from app.group_member.routes import router as group_member_router
from app.group_settings.routes import router as group_settings_router
from app.invite.routes import router as invite_router
from app.join_request.routes import router as join_request_router
from app.cycle.routes import router as cycle_router


def register_routes(app: FastAPI) -> None:
    app.include_router(main_router)
    app.include_router(user_router)
    app.include_router(group_router)
    app.include_router(group_member_router)
    app.include_router(group_settings_router)
    app.include_router(invite_router)
    app.include_router(join_request_router)
    app.include_router(cycle_router)
