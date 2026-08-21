from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie


async def get_movie_by_id(session: AsyncSession, movie_id: int) -> Movie | None:
    stmt = select(Movie).where(Movie.id == movie_id)
    result = await session.execute(stmt)
    movie = result.scalar_one_or_none()
    return movie


async def get_all_movies(session: AsyncSession) -> Sequence[Movie]:
    stmt = select(Movie)
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return movies


async def get_random_movies(session: AsyncSession, count: int = 10) -> Sequence[Movie]:
    stmt = select(Movie).order_by(func.random()).limit(count)
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return movies


async def get_movies_by_genre(
    session: AsyncSession,
    genre: str,
    count: int = 10,
) -> Sequence[Movie]:
    stmt = (
        select(Movie)
        .where(
            (Movie.genre == genre) | (Movie.genre_2 == genre) | (Movie.genre_3 == genre)
        )
        .order_by(func.random())
        .limit(count)
    )
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return movies


async def get_genres_list(session: AsyncSession) -> Sequence[str]:
    stmt = select(Movie.genre).distinct()
    result = await session.execute(stmt)
    genres = result.scalars().all()
    return genres


async def get_random_movies_except(
    session: AsyncSession,
    exclude_ids: list[int],
    count: int = 10,
    genre: str | None = None,
) -> Sequence[Movie]:
    stmt = select(Movie).where(Movie.id.notin_(exclude_ids))

    if genre:
        stmt = stmt.where(
            (Movie.genre == genre) | (Movie.genre_2 == genre) | (Movie.genre_3 == genre)
        )

    stmt = stmt.order_by(func.random()).limit(count)

    result = await session.execute(stmt)
    return result.scalars().all()


async def count_movies(session: AsyncSession, genre: str | None = None) -> int:
    stmt = select(func.count(Movie.id))
    if genre:
        stmt = stmt.where(
            (Movie.genre == genre) | (Movie.genre_2 == genre) | (Movie.genre_3 == genre)
        )
    result = await session.execute(stmt)
    return result.scalar_one()


async def get_catalog_movies(
    session: AsyncSession,
    page: int = 1,
    limit: int = 24,
    search: str | None = None,
    genre: str | None = None,
):
    filters = []

    if search:
        clean_search = search.strip()

        if clean_search:
            filters.append(Movie.title.ilike(f"%{clean_search}%"))

    if genre:
        filters.append(
            (Movie.genre == genre) | (Movie.genre_2 == genre) | (Movie.genre_3 == genre)
        )

    count_stmt = select(func.count(Movie.id))

    if filters:
        count_stmt = count_stmt.where(*filters)

    count_result = await session.execute(count_stmt)

    total = count_result.scalar_one()

    stmt = (
        select(Movie)
        .order_by(
            Movie.created_at.desc(),
            Movie.id.desc(),
        )
        .offset((page - 1) * limit)
        .limit(limit)
    )

    if filters:
        stmt = stmt.where(*filters)

    result = await session.execute(stmt)

    return result.scalars().all(), total
