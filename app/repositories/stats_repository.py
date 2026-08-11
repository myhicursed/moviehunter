from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_quiz import DailyQuizAttempt
from app.models.game_answer import GameAnswer
from app.models.movie import Movie
from app.models.user import User


async def get_user_stats(session: AsyncSession, user_id: int) -> dict:
    stmt = select(func.count(GameAnswer.id)).where(GameAnswer.user_id == user_id)
    result = await session.execute(stmt)
    total_answers = result.scalar_one()

    stmt = select(func.count(GameAnswer.id)).where(
        GameAnswer.user_id == user_id,
        GameAnswer.is_correct.is_(True),
    )
    result = await session.execute(stmt)
    correct_answers = result.scalar_one()

    stmt = select(func.sum(GameAnswer.points)).where(GameAnswer.user_id == user_id)
    result = await session.execute(stmt)
    total_points = result.scalar_one() or 0

    stmt = select(func.sum(DailyQuizAttempt.bonus_earned)).where(
        DailyQuizAttempt.user_id == user_id,
        DailyQuizAttempt.is_completed.is_(True),
    )
    result = await session.execute(stmt)
    daily_bonus = result.scalar_one() or 0

    total_points += daily_bonus

    stmt = (
        select(Movie.genre, func.count(GameAnswer.id))
        .join(Movie, GameAnswer.movie_id == Movie.id)
        .where(GameAnswer.user_id == user_id, GameAnswer.is_correct.is_(True))
        .group_by(Movie.genre)
        .order_by(func.count(GameAnswer.id).desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    row = result.first()
    favorite_genre = row[0] if row else None

    wrong_answers = total_answers - correct_answers
    accuracy = (
        round((correct_answers / total_answers * 100), 1) if total_answers > 0 else 0
    )

    return {
        "total_answers": total_answers,
        "correct_answers": correct_answers,
        "wrong_answers": wrong_answers,
        "accuracy": accuracy,
        "total_points": total_points,
        "favorite_genre": favorite_genre,
    }


async def get_leaderboard(session: AsyncSession, limit: int = 10) -> list[dict]:
    # 1. Очки из обычных ответов
    stmt_answers = (
        select(
            User.id,
            User.username,
            User.avatar,
            func.sum(GameAnswer.points).label("points"),
        )
        .join(GameAnswer, GameAnswer.user_id == User.id)
        .group_by(User.id, User.username, User.avatar)
    )
    result = await session.execute(stmt_answers)
    users_points = {
        row.id: {
            "id": row.id,
            "username": row.username,
            "avatar": row.avatar,
            "points": row.points or 0,
        }
        for row in result.all()
    }

    # 2. Бонусы из ежедневных
    stmt_bonus = (
        select(
            DailyQuizAttempt.user_id,
            func.sum(DailyQuizAttempt.bonus_earned).label("bonus"),
        )
        .where(DailyQuizAttempt.is_completed.is_(True))
        .group_by(DailyQuizAttempt.user_id)
    )
    result = await session.execute(stmt_bonus)
    users_bonuses = {row.user_id: row.bonus or 0 for row in result.all()}

    # 3. Суммируем всё
    for user_id, bonus in users_bonuses.items():
        if user_id in users_points:
            users_points[user_id]["points"] += bonus
        else:
            # Юзер только daily играл, обычных ответов нет
            # Достанем его инфу отдельно
            user_stmt = select(User).where(User.id == user_id)
            user_result = await session.execute(user_stmt)
            user = user_result.scalar_one_or_none()
            if user:
                users_points[user_id] = {
                    "id": user.id,
                    "username": user.username,
                    "avatar": user.avatar,
                    "points": bonus,
                }

    # 4. Сортируем и берём топ
    sorted_users = sorted(
        users_points.values(),
        key=lambda x: x["points"],
        reverse=True,
    )[:limit]

    # 5. Форматируем ответ
    return [
        {
            "position": i + 1,
            "user_id": u["id"],
            "username": u["username"],
            "avatar": u["avatar"],
            "total_points": u["points"],
        }
        for i, u in enumerate(sorted_users)
    ]
