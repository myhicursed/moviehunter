import random

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text_utils import clean_title_for_letters
from app.models.user import User
from app.repositories.game_answer_repository import create_game_answer
from app.repositories.movie_repository import (
    count_movies,
    get_movie_by_id,
    get_movies_by_genre,
    get_random_movies,
    get_random_movies_except,
)
from app.schemas.quiz import LetterQuestion, QuizQuestion, QuizResult

MIN_MOVIES = 4
DIFFICULTY_POINTS = {
    "easy": 1,
    "medium": 2,
    "hard": 3,
}


async def create_quiz(
    session: AsyncSession,
    count: int = 10,
    genre: str | None = None,
) -> list[QuizQuestion]:
    # Считаем фильмы с учётом жанра
    total = await count_movies(session, genre=genre)
    if total < 4:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно фильмов в базе. Нужно минимум 4, есть {total}",
        )

    # Правильные фильмы — либо из жанра, либо из всех
    if genre:
        correct_movies = await get_movies_by_genre(session, genre, count)
    else:
        correct_movies = await get_random_movies(session, count)

    questions = []

    for correct in correct_movies:
        # Неправильные — с учётом жанра
        wrong = await get_random_movies_except(
            session,
            exclude_ids=[correct.id],
            count=3,
            genre=genre,
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

    return questions


async def save_answer(
    session: AsyncSession,
    movie_id: int,
    user_answer: str,
    current_user: User | None,
    mode: str | None = None,
) -> QuizResult:
    # 1. Достать фильм
    movie = await get_movie_by_id(session, movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # 2. Проверить ответ
    letter_matches = None

    if mode == "letters":
        correct_title = clean_title_for_letters(movie.title)
        user_clean = user_answer.strip().upper()
        is_correct = correct_title == user_clean
        correct_answer_display = correct_title

        if not is_correct and user_answer != "__surrender__":
            letter_matches = []
            for i in range(len(correct_title)):
                if i < len(user_clean) and user_clean[i] == correct_title[i]:
                    letter_matches.append(True)
                else:
                    letter_matches.append(False)
    else:
        # Обработка таймаута
        if user_answer == "__timeout__":
            is_correct = False
            correct_answer_display = movie.title
        else:
            is_correct = movie.title == user_answer
            correct_answer_display = movie.title

    # 3. Посчитать очки
    points = DIFFICULTY_POINTS.get(movie.difficulty, 1) if is_correct else 0

    # Умножитель для режима letters
    if mode == "letters" and is_correct:
        points *= 2

    # 4. Сохранить, если авторизован (но не при timeout)

    if current_user is not None and user_answer != "__timeout__":
        await create_game_answer(
            session=session,
            user_id=current_user.id,
            movie_id=movie.id,
            is_correct=is_correct,
            points=points,
        )

    # 5. Вернуть результат
    return QuizResult(
        correct=is_correct,
        correct_answer=correct_answer_display,
        points=points,
        letter_matches=letter_matches,
    )


async def create_letters_quiz(
    session: AsyncSession,
    count: int = 10,
) -> list[LetterQuestion]:
    # Проверка минимума (можно просто >= 1 фильма, ведь варианты не нужны)
    total = await count_movies(session)
    if total < 1:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно фильмов в базе. Нужно минимум 4, есть {total}",
        )

    # Получить случайные фильмы
    movies = await get_random_movies(session, count)

    questions = []
    for movie in movies:
        # 1. Очистить название
        clean = clean_title_for_letters(movie.title)

        # 2. Собрать позиции пробелов
        spaces = [i for i, ch in enumerate(clean) if ch == " "]

        # 3. Собрать буквы (без пробелов) и перемешать
        letters = [ch for ch in clean if ch != " "]
        random.shuffle(letters)

        # 4. Создать вопрос
        question = LetterQuestion(
            movie_id=movie.id,
            filename=movie.filename,
            difficulty=movie.difficulty,
            answer_length=len(clean),
            letters=letters,
            spaces=spaces,
        )
        questions.append(question)

    return questions
