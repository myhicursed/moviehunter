from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.genres import GENRES
from app.core.security import get_current_user, get_current_user_optional
from app.db.database import get_session
from app.models.user import User
from app.schemas.daily_quiz import DailyQuizFinish, DailyQuizResponse
from app.schemas.quiz import Genre, LetterQuestion, QuizAnswer, QuizQuestion, QuizResult
from app.services.daily_quiz_service import finish_daily_quiz, get_daily_quiz_for_user
from app.services.quiz_service import create_letters_quiz, create_quiz, save_answer

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


@router.get("/start", response_model=list[QuizQuestion])
async def start_quiz(
    session: AsyncSession = Depends(get_session),
    genre: str | None = None,
):
    return await create_quiz(session, genre=genre)


@router.post("/answer", response_model=QuizResult)
async def check_response(
    data: QuizAnswer,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await save_answer(
        session=session,
        movie_id=data.movie_id,
        user_answer=data.user_answer,
        current_user=current_user,
        mode=data.mode,  # ← добавь
    )


@router.get("/genres", response_model=list[Genre])
async def get_genres():
    return [Genre(code=code, name=name) for code, name in GENRES.items()]


@router.get("/daily", response_model=DailyQuizResponse)
async def daily_quiz(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_daily_quiz_for_user(session, current_user)


@router.post("/daily/finish", response_model=DailyQuizResponse)
async def finish_daily(
    data: DailyQuizFinish,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await finish_daily_quiz(session, current_user, data.correct_count)


@router.get("/letters", response_model=list[LetterQuestion])
async def start_letters_quiz(
    session: AsyncSession = Depends(get_session),
):
    return await create_letters_quiz(session)
