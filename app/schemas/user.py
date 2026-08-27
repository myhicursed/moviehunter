from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    username: str
    avatar: str
    created_at: datetime
    current_streak: int = 0

    model_config = ConfigDict(from_attributes=True)


class UserStats(BaseModel):
    total_answers: int
    correct_answers: int
    wrong_answers: int
    accuracy: float
    total_points: int
    favorite_genre: str | None


class UserProfile(BaseModel):
    id: int
    username: str
    email: str | None = None
    avatar: str
    created_at: datetime
    stats: UserStats
    current_streak: int = 0

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntry(BaseModel):
    position: int
    user_id: int
    username: str
    avatar: str
    total_points: int


class LeaderboardResponse(BaseModel):
    period: str

    entries: list[LeaderboardEntry]

    current_user: LeaderboardEntry | None = None

    points_to_next: int | None = None


class AvatarUpdate(BaseModel):
    avatar: str


class UserEmailUpdate(BaseModel):
    email: str


class UserPasswordUpdate(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
