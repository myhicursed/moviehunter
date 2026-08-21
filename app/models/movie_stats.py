from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class MovieStats(Base):
    __tablename__ = "movie_stats"

    movie_id: Mapped[int] = mapped_column(
        ForeignKey(
            "movies.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    correct: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
