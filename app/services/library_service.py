from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.library_repository import (
    add_movie_to_library,
    get_user_library,
    is_movie_in_library,
    remove_movie_from_library,
)
from app.repositories.movie_repository import get_movie_by_id
from app.schemas.library import LibraryMovie, LibraryState


async def add_library_movie(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> LibraryState:
    movie = await get_movie_by_id(
        session,
        movie_id,
    )

    if not movie:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден",
        )

    await add_movie_to_library(
        session=session,
        user_id=user_id,
        movie_id=movie_id,
    )

    return LibraryState(
        movie_id=movie_id,
        in_library=True,
    )


async def delete_library_movie(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> LibraryState:
    await remove_movie_from_library(
        session=session,
        user_id=user_id,
        movie_id=movie_id,
    )

    return LibraryState(
        movie_id=movie_id,
        in_library=False,
    )


async def get_library(
    session: AsyncSession,
    user_id: int,
) -> list[LibraryMovie]:
    rows = await get_user_library(
        session,
        user_id,
    )

    movies = []

    for library_entry, movie in rows:
        poster_url = None

        if movie.poster_filename:
            poster_url = f"/media/posters/{movie.poster_filename}"

        movies.append(
            LibraryMovie(
                movie_id=movie.id,
                title=movie.title,
                year=movie.year,
                poster_url=poster_url,
                added_at=library_entry.created_at,
            )
        )

    return movies


async def get_library_state(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> LibraryState:
    in_library = await is_movie_in_library(
        session=session,
        user_id=user_id,
        movie_id=movie_id,
    )

    return LibraryState(
        movie_id=movie_id,
        in_library=in_library,
    )
