from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_session
from app.models.user import User
from app.schemas.library import LibraryMovie, LibraryState
from app.services.library_service import (
    add_library_movie,
    delete_library_movie,
    get_library,
    get_library_state,
)

router = APIRouter(
    prefix="/api/library",
    tags=["Library"],
)


# ============================================
# МОЯ БИБЛИОТЕКА
# ============================================


@router.get(
    "/me",
    response_model=list[LibraryMovie],
)
async def my_library(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_library(
        session=session,
        user_id=current_user.id,
    )


# ============================================
# БИБЛИОТЕКА ДРУГОГО ПОЛЬЗОВАТЕЛЯ
# Публичное чтение
# ============================================


@router.get(
    "/user/{user_id}",
    response_model=list[LibraryMovie],
)
async def user_library(
    user_id: int,
    session: AsyncSession = Depends(get_session),
):
    return await get_library(
        session=session,
        user_id=user_id,
    )


# ============================================
# СОСТОЯНИЕ ФИЛЬМА
# ============================================


@router.get(
    "/{movie_id}",
    response_model=LibraryState,
)
async def library_state(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_library_state(
        session=session,
        user_id=current_user.id,
        movie_id=movie_id,
    )


# ============================================
# ДОБАВИТЬ
# ============================================


@router.post(
    "/{movie_id}",
    response_model=LibraryState,
)
async def add_to_library(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await add_library_movie(
        session=session,
        user_id=current_user.id,
        movie_id=movie_id,
    )


# ============================================
# УДАЛИТЬ
# ============================================


@router.delete(
    "/{movie_id}",
    response_model=LibraryState,
)
async def remove_from_library(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await delete_library_movie(
        session=session,
        user_id=current_user.id,
        movie_id=movie_id,
    )
