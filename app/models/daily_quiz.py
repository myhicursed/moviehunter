from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class DailyQuiz(Base):
    __tablename__ = "daily_quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    bonus_points: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    perfect_bonus: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Связь с фильмами
    movies: Mapped[list["DailyQuizMovie"]] = relationship(
        back_populates="daily_quiz",
        cascade="all, delete-orphan",
    )

    def __str__(self):
        return f"Квиз на {self.date}"


class DailyQuizMovie(Base):
    __tablename__ = "daily_quiz_movies"

    id: Mapped[int] = mapped_column(primary_key=True)
    daily_quiz_id: Mapped[int] = mapped_column(
        ForeignKey("daily_quizzes.id", ondelete="CASCADE"),
        index=True,
    )
    movie_id: Mapped[int] = mapped_column(
        ForeignKey("movies.id", ondelete="CASCADE"),
    )
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Связи
    daily_quiz: Mapped["DailyQuiz"] = relationship(back_populates="movies")
    movie: Mapped["Movie"] = relationship()

    def __str__(self):
        return f"Фильм #{self.movie_id} в квизе #{self.daily_quiz_id}"


class DailyQuizAttempt(Base):
    __tablename__ = "daily_quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    daily_quiz_id: Mapped[int] = mapped_column(
        ForeignKey("daily_quizzes.id", ondelete="CASCADE"),
        index=True,
    )
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    bonus_earned: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(default=False)
    current_question: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Связи
    user: Mapped["User"] = relationship()
    daily_quiz: Mapped["DailyQuiz"] = relationship()
