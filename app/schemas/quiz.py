from pydantic import BaseModel


class QuizQuestion(BaseModel):
    movie_id: int
    difficulty: str
    filename: str
    options: list[str]


class QuizAnswer(BaseModel):
    movie_id: int
    user_answer: str
    mode: str | None = None


class QuizResult(BaseModel):
    correct: bool
    correct_answer: str
    points: int
    letter_matches: list[bool] | None = None


class Genre(BaseModel):
    code: str
    name: str


class LetterQuestion(BaseModel):
    movie_id: int
    filename: str
    difficulty: str
    answer_length: int
    letters: list[str]
    spaces: list[int]
