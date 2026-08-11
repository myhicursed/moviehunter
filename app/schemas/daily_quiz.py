from pydantic import BaseModel

from app.schemas.quiz import QuizQuestion  # уже есть


class DailyQuizResponse(BaseModel):
    status: str  # "no_quiz" / "playing" / "completed"

    # Опциональные (для разных статусов)
    questions: list[QuizQuestion] | None = None
    current_question: int | None = None
    total_questions: int | None = None
    correct_count: int | None = None
    bonus_earned: int | None = None
    current_streak: int | None = None
    message: str | None = None


class DailyQuizFinish(BaseModel):
    correct_count: int
