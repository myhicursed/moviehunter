from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    stmt = select(User).where(User.username == username)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    return user


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    return user


async def create_user(
    session: AsyncSession, username: str, hashed_password: str
) -> User:
    user = User(username=username, hashed_password=hashed_password)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user_avatar(
    session: AsyncSession,
    user_id: int,
    avatar: str,
) -> User | None:
    user = await get_user_by_id(session, user_id)
    if user is None:
        return None

    user.avatar = avatar
    await session.commit()
    await session.refresh(user)
    return user
