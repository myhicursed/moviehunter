from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    year: Mapped[int] = mapped_column(Integer)
    director: Mapped[str | None] = mapped_column(String(200), nullable=True)
    genre: Mapped[str] = mapped_column(String(50))
    genre_2: Mapped[str | None] = mapped_column(String(50), nullable=True) 
    genre_3: Mapped[str | None] = mapped_column(String(50), nullable=True) 
    difficulty: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # easy/medium/hard
    filename: Mapped[str] = mapped_column(String(500))  # видеофайл
    poster_filename: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # постер
    country: Mapped[str] = mapped_column(String(20), server_default="foreign")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    @property
    def file(self):
        return None

    @file.setter
    def file(self, value):
        pass

    @property
    def poster(self):
        return None

    @poster.setter
    def poster(self, value):
        pass

    def __repr__(self):
        return f"{self.title} ({self.year})"

    def __str__(self):
        return f"{self.title} ({self.year})"
