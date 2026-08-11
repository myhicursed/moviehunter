from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_quiz import DailyQuiz, DailyQuizAttempt, DailyQuizMovie
from app.models.movie import Movie


async def get_daily_quiz_by_date(
    session: AsyncSession, target_date: date
) -> DailyQuiz | None:
    stmt = select(DailyQuiz).where(DailyQuiz.date == target_date)
    result = await session.execute(stmt)
    current_quiz = result.scalar_one_or_none()
    return current_quiz


async def get_daily_quiz_movies(
    session: AsyncSession, daily_quiz_id: int
) -> list[Movie]:
    stmt = (
        select(Movie)
        .join(DailyQuizMovie, DailyQuizMovie.movie_id == Movie.id)
        .where(DailyQuizMovie.daily_quiz_id == daily_quiz_id)
        .order_by(DailyQuizMovie.order)
    )
    result = await session.execute(stmt)
    current_list_movies = result.scalars().all()
    return list(current_list_movies)


async def get_user_attempt(
    session: AsyncSession, user_id: int, daily_quiz_id: int
) -> DailyQuizAttempt | None:
    stmt = select(DailyQuizAttempt).where(
        DailyQuizAttempt.user_id == user_id,
        DailyQuizAttempt.daily_quiz_id == daily_quiz_id,
    )
    result = await session.execute(stmt)
    attempt = result.scalar_one_or_none()
    return attempt


async def create_attempt(
    session: AsyncSession, user_id: int, daily_quiz_id: int
) -> DailyQuizAttempt:
    attempt = DailyQuizAttempt(user_id=user_id, daily_quiz_id=daily_quiz_id)
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt


async def update_attempt(
    session: AsyncSession, attempt: DailyQuizAttempt
) -> DailyQuizAttempt:
    await session.commit()
    await session.refresh(attempt)
    return attempt
