from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_quiz import DailyQuizAttempt
from app.models.game_answer import GameAnswer
from app.models.movie import Movie
from app.models.user import User

# Безопасная инициализация таймзоны (поддерживает Windows и Linux)
try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except (ZoneInfoNotFoundError, Exception):
    MOSCOW_TZ = timezone(timedelta(hours=3))


# ============================================
# ГРАНИЦЫ ТЕКУЩЕЙ НЕДЕЛИ
# ============================================


def get_current_week_bounds() -> tuple[datetime, datetime]:
    """
    Текущая неделя по Москве:
    понедельник 00:00:00 -> следующий понедельник 00:00:00
    """
    now = datetime.now(MOSCOW_TZ)

    start = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ) - timedelta(days=now.weekday())

    end = start + timedelta(days=7)

    return start, end


# ============================================
# СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ
# ============================================


async def get_user_stats(
    session: AsyncSession,
    user_id: int,
) -> dict:

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
        select(
            Movie.genre,
            func.count(GameAnswer.id),
        )
        .join(
            Movie,
            GameAnswer.movie_id == Movie.id,
        )
        .where(
            GameAnswer.user_id == user_id,
            GameAnswer.is_correct.is_(True),
        )
        .group_by(Movie.genre)
        .order_by(func.count(GameAnswer.id).desc())
        .limit(1)
    )

    result = await session.execute(stmt)

    row = result.first()

    favorite_genre = row[0] if row else None

    wrong_answers = total_answers - correct_answers

    accuracy = (
        round(
            correct_answers / total_answers * 100,
            1,
        )
        if total_answers > 0
        else 0
    )

    return {
        "total_answers": total_answers,
        "correct_answers": correct_answers,
        "wrong_answers": wrong_answers,
        "accuracy": accuracy,
        "total_points": total_points,
        "favorite_genre": favorite_genre,
    }


# ============================================
# ПОЛУЧИТЬ ВСЕ ОЧКИ ДЛЯ LEADERBOARD
# ============================================


async def get_leaderboard_points(
    session: AsyncSession,
    period: str = "all",
) -> list[dict]:

    week_start = None
    week_end = None

    if period == "week":
        week_start, week_end = get_current_week_bounds()

    # ========================================
    # ОЧКИ ЗА ОТВЕТЫ
    # ========================================

    stmt_answers = select(
        User.id,
        User.username,
        User.avatar,
        func.sum(GameAnswer.points).label("points"),
    ).join(
        GameAnswer,
        GameAnswer.user_id == User.id,
    )

    if period == "week":
        stmt_answers = stmt_answers.where(
            GameAnswer.answered_at >= week_start,
            GameAnswer.answered_at < week_end,
        )

    stmt_answers = stmt_answers.group_by(
        User.id,
        User.username,
        User.avatar,
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

    # ========================================
    # DAILY БОНУСЫ
    # ========================================

    stmt_bonus = select(
        DailyQuizAttempt.user_id,
        func.sum(DailyQuizAttempt.bonus_earned).label("bonus"),
    ).where(DailyQuizAttempt.is_completed.is_(True))

    if period == "week":
        stmt_bonus = stmt_bonus.where(
            DailyQuizAttempt.completed_at >= week_start,
            DailyQuizAttempt.completed_at < week_end,
        )

    stmt_bonus = stmt_bonus.group_by(DailyQuizAttempt.user_id)

    result = await session.execute(stmt_bonus)

    users_bonuses = {row.user_id: row.bonus or 0 for row in result.all()}

    # ========================================
    # СКЛАДЫВАЕМ
    # ========================================

    for user_id, bonus in users_bonuses.items():

        if user_id in users_points:

            users_points[user_id]["points"] += bonus

        else:

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

    # ========================================
    # СОРТИРОВКА
    #
    # При одинаковом количестве очков
    # меньший user ID выше.
    # Так позиция стабильна.
    # ========================================

    sorted_users = sorted(
        users_points.values(),
        key=lambda x: (
            -x["points"],
            x["id"],
        ),
    )

    # Назначаем позиции
    for index, user in enumerate(
        sorted_users,
        start=1,
    ):
        user["position"] = index

    return sorted_users


# ============================================
# LEADERBOARD С ПЕРСОНАЛЬНОЙ ПОЗИЦИЕЙ
# ============================================


async def get_leaderboard_data(
    session: AsyncSession,
    period: str,
    limit: int,
    current_user_id: int | None,
) -> dict:

    users = await get_leaderboard_points(
        session=session,
        period=period,
    )

    top_users = users[:limit]

    entries = [
        {
            "position": user["position"],
            "user_id": user["id"],
            "username": user["username"],
            "avatar": user["avatar"],
            "total_points": user["points"],
        }
        for user in top_users
    ]

    current_user_entry = None
    points_to_next = None

    if current_user_id is not None:

        user_index = next(
            (
                index
                for index, user in enumerate(users)
                if user["id"] == current_user_id
            ),
            None,
        )

        if user_index is not None:

            user = users[user_index]

            current_user_entry = {
                "position": user["position"],
                "user_id": user["id"],
                "username": user["username"],
                "avatar": user["avatar"],
                "total_points": user["points"],
            }

            # Если есть игрок выше
            if user_index > 0:

                previous_user = users[user_index - 1]

                points_to_next = max(
                    1,
                    previous_user["points"] - user["points"] + 1,
                )

    return {
        "period": period,
        "entries": entries,
        "current_user": current_user_entry,
        "points_to_next": points_to_next,
    }


# ============================================
# СТАРАЯ ФУНКЦИЯ
#
# Оставляем для главной страницы,
# чтобы существующий index.js не сломался.
# ============================================


async def get_leaderboard(
    session: AsyncSession,
    limit: int = 10,
) -> list[dict]:

    users = await get_leaderboard_points(
        session=session,
        period="all",
    )

    return [
        {
            "position": user["position"],
            "user_id": user["id"],
            "username": user["username"],
            "avatar": user["avatar"],
            "total_points": user["points"],
        }
        for user in users[:limit]
    ]
