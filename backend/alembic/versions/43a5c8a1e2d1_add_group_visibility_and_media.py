"""add group visibility and media

Revision ID: 43a5c8a1e2d1
Revises: 9e50e6bb4a1f
Create Date: 2026-04-14 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "43a5c8a1e2d1"
down_revision: Union[str, Sequence[str], None] = "9e50e6bb4a1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("groups", sa.Column("group_image", sa.String(length=255), nullable=True))
    op.add_column("groups", sa.Column("cover_image", sa.String(length=255), nullable=True))
    op.alter_column("groups", "visible", server_default=None)


def downgrade() -> None:
    op.drop_column("groups", "cover_image")
    op.drop_column("groups", "group_image")
    op.drop_column("groups", "visible")
