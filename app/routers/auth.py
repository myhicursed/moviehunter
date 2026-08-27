import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_current_user, hash_password
from app.core.timezone import now_moscow
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserLogin,
    UserRead,
    UserRegister,
)
from app.services.email_service import send_reset_password_email
from app.services.user_service import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead)
async def register(data: UserRegister, session=Depends(get_session)):
    user = await register_user(
        session,
        data.username,
        data.password,
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    data: UserLogin,
    session: AsyncSession = Depends(get_session),
):
    user = await authenticate_user(session, data.username, data.password)
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)
):
    # Приводим email к нижнему регистру
    clean_email = data.email.strip().lower()

    stmt = select(User).where(User.email == clean_email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if not user:
        # В целях безопасности возвращаем success, даже если почты нет
        return {"status": "success"}

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = now_moscow() + timedelta(hours=1)
    await session.commit()

    await send_reset_password_email(user.email, token)

    return {"status": "success"}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest, session: AsyncSession = Depends(get_session)
):
    stmt = select(User).where(User.reset_token == data.token)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if (
        not user
        or not user.reset_token_expires
        or user.reset_token_expires < now_moscow()
    ):
        raise HTTPException(
            status_code=400, detail="Ссылка устарела или недействительна"
        )

    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await session.commit()

    return {"status": "success"}
