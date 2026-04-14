"""add user session settings

Revision ID: c36ef3e1d8a2
Revises: 43a5c8a1e2d1
Create Date: 2026-04-15 00:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c36ef3e1d8a2"
down_revision: Union[str, Sequence[str], None] = "43a5c8a1e2d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("session_hours", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("active_session_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "active_session_id")
    op.drop_column("users", "session_hours")
