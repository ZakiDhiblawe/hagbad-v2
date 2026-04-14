"""add user profile image

Revision ID: 9e50e6bb4a1f
Revises: 6c7137353df8
Create Date: 2026-04-14 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9e50e6bb4a1f"
down_revision: Union[str, Sequence[str], None] = "6c7137353df8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image")
