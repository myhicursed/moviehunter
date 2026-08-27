from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.avatars import AVAILABLE_AVATARS
from app.core.security import hash_password, verify_password
from app.core.text_utils import is_username_banned
from app.models.user import User
from app.repositories.stats_repository import get_user_stats
from app.repositories.user_repository import (
    create_user,
    get_user_by_id,
    get_user_by_username,
    update_user_avatar,
)
from app.schemas.user import UserProfile, UserStats


async def register_user(session: AsyncSession, username: str, password: str) -> User:
    is_banned, banned_word = is_username_banned(username)
    if is_banned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Никнейм содержит недопустимые слова. Выбери другой.",
        )

    # Существующая логика
    existing = await get_user_by_username(session, username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    hashed_password = hash_password(password)
    user = await create_user(session, username, hashed_password)
    return user


async def authenticate_user(
    session: AsyncSession, username: str, password: str
) -> User:
    user = await get_user_by_username(session, username)

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )
    return user


async def get_user_profile(
    session: AsyncSession, user_id: int, requester_id: int | None = None
) -> UserProfile:
    user = await get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stats = await get_user_stats(session, user_id)

    # Показываем email только если профиль запрашивает его владелец
    email = user.email if requester_id == user.id else None

    return UserProfile(
        id=user.id,
        username=user.username,
        email=email,
        avatar=user.avatar,
        created_at=user.created_at,
        stats=UserStats(**stats),
        current_streak=user.current_streak,
    )


async def change_email(session: AsyncSession, user_id: int, email: str) -> UserProfile:
    # Проверяем, не занят ли email другим юзером
    stmt = select(User).where(User.email == email, User.id != user_id)
    existing = await session.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Этот email уже используется другим аккаунтом"
        )

    user = await get_user_by_id(session, user_id)
    user.email = email
    await session.commit()

    return await get_user_profile(session, user_id, requester_id=user_id)


async def change_password(
    session: AsyncSession, user_id: int, old_password: str, new_password: str
):
    user = await get_user_by_id(session, user_id)

    if not verify_password(old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный старый пароль")

    user.hashed_password = hash_password(new_password)
    await session.commit()
    return {"status": "success"}


async def change_avatar(session: AsyncSession, user_id: int, avatar: str) -> User:
    if avatar not in AVAILABLE_AVATARS:
        raise HTTPException(status_code=400, detail="Invalid avatar")

    user = await update_user_avatar(session, user_id, avatar)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user
