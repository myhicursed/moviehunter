from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.avatars import AVAILABLE_AVATARS
from app.core.security import hash_password, verify_password
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
    existing = await get_user_by_username(session, username)
    if existing:
        raise HTTPException(status_code=400, detail="User already registered")
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


async def get_user_profile(session: AsyncSession, user_id: int) -> UserProfile:
    user = await get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stats = await get_user_stats(session, user_id)

    return UserProfile(
        id=user.id,
        username=user.username,
        avatar=user.avatar,
        created_at=user.created_at,
        stats=UserStats(**stats),
        current_streak=user.current_streak,
    )


async def change_avatar(session: AsyncSession, user_id: int, avatar: str) -> User:
    if avatar not in AVAILABLE_AVATARS:
        raise HTTPException(status_code=400, detail="Invalid avatar")

    user = await update_user_avatar(session, user_id, avatar)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user
