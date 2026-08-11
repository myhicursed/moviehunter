import random
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.daily_quiz_repository import (
    create_attempt,
    get_daily_quiz_by_date,
    get_daily_quiz_movies,
    get_user_attempt,
)
from app.repositories.movie_repository import get_random_movies_except
from app.schemas.daily_quiz import DailyQuizResponse
from app.schemas.quiz import QuizQuestion

# Бонус за каждые 7 дней подряд
WEEK_STREAK_BONUS = 50


async def get_daily_quiz_for_user(
    session: AsyncSession,
    user: User,
) -> DailyQuizResponse:
    today = date.today()

    # 1. Получить квиз на сегодня
    quiz = await get_daily_quiz_by_date(session, today)
    if not quiz:
        return DailyQuizResponse(status="no_quiz", message="На сегодня квиза нет")

    # 2. Проверить попытку юзера
    attempt = await get_user_attempt(session, user.id, quiz.id)

    # 3. Если попытки нет — создать
    if not attempt:
        attempt = await create_attempt(session, user.id, quiz.id)

    # 4. Получить фильмы квиза
    movies = await get_daily_quiz_movies(session, quiz.id)

    # 5. Если уже прошёл — вернуть результат
    if attempt.is_completed:
        return DailyQuizResponse(
            status="completed",
            correct_count=attempt.correct_count,
            total_questions=len(movies),
            bonus_earned=attempt.bonus_earned,
            current_streak=user.current_streak,
        )

    # 6. Сгенерировать вопросы для каждого фильма
    questions = []
    for correct in movies:
        wrong = await get_random_movies_except(
            session,
            exclude_ids=[correct.id],
            count=3,
        )

        options = [correct.title] + [w.title for w in wrong]
        random.shuffle(options)

        question = QuizQuestion(
            movie_id=correct.id,
            difficulty=correct.difficulty,
            filename=correct.filename,
            options=options,
        )
        questions.append(question)

    return DailyQuizResponse(
        status="playing",
        questions=questions,
        current_question=attempt.current_question,
        total_questions=len(movies),
        current_streak=user.current_streak,
    )


async def finish_daily_quiz(
    session: AsyncSession,
    user: User,
    correct_count: int,
) -> DailyQuizResponse:
    today = date.today()

    # 1. Получить квиз на сегодня
    quiz = await get_daily_quiz_by_date(session, today)
    if not quiz:
        raise HTTPException(status_code=404, detail="На сегодня квиза нет")

    # 2. Получить попытку юзера
    attempt = await get_user_attempt(session, user.id, quiz.id)
    if not attempt:
        raise HTTPException(status_code=400, detail="Ты не начинал квиз")

    # 3. Проверить, не завершён ли уже
    if attempt.is_completed:
        raise HTTPException(status_code=400, detail="Квиз уже пройден сегодня")

    # 4. Получить фильмы (чтобы знать total_questions)
    movies = await get_daily_quiz_movies(session, quiz.id)
    total_questions = len(movies)

    # 5. Считаем базовый бонус
    bonus = quiz.bonus_points
    if correct_count == total_questions:
        bonus += quiz.perfect_bonus

    # 6. Обновляем streak
    yesterday = today - timedelta(days=1)
    if user.last_daily_completed_date == yesterday:
        user.current_streak += 1
    else:
        user.current_streak = 1
    user.last_daily_completed_date = today

    # 7. Бонус за каждые 7 дней подряд (7, 14, 21, ...)
    if user.current_streak % 7 == 0:
        bonus += WEEK_STREAK_BONUS

    # 8. Обновляем попытку финальными данными
    attempt.correct_count = correct_count
    attempt.bonus_earned = bonus
    attempt.is_completed = True
    attempt.completed_at = datetime.now(timezone.utc)

    # 9. Один общий commit
    await session.commit()
    await session.refresh(attempt)
    await session.refresh(user)

    # 10. Вернуть результат
    return DailyQuizResponse(
        status="completed",
        correct_count=correct_count,
        total_questions=total_questions,
        bonus_earned=bonus,
        current_streak=user.current_streak,
    )
