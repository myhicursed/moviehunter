from sqlalchemy import delete, exists, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.movie_library import MovieLibrary


async def is_movie_in_library(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> bool:
    query = select(
        exists().where(
            MovieLibrary.user_id == user_id,
            MovieLibrary.movie_id == movie_id,
        )
    )

    result = await session.execute(query)

    return bool(result.scalar())


async def add_movie_to_library(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> None:
    stmt = (
        insert(MovieLibrary)
        .values(
            user_id=user_id,
            movie_id=movie_id,
        )
        .on_conflict_do_nothing(constraint="uq_user_movie_library_user_movie")
    )

    await session.execute(stmt)
    await session.commit()


async def remove_movie_from_library(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> None:
    stmt = delete(MovieLibrary).where(
        MovieLibrary.user_id == user_id,
        MovieLibrary.movie_id == movie_id,
    )

    await session.execute(stmt)
    await session.commit()


async def get_user_library(
    session: AsyncSession,
    user_id: int,
):
    stmt = (
        select(
            MovieLibrary,
            Movie,
        )
        .join(
            Movie,
            Movie.id == MovieLibrary.movie_id,
        )
        .where(MovieLibrary.user_id == user_id)
        .order_by(MovieLibrary.created_at.desc())
    )

    result = await session.execute(stmt)

    return result.all()


async def count_movie_library(
    session: AsyncSession,
    movie_id: int,
) -> int:
    stmt = select(func.count(MovieLibrary.id)).where(MovieLibrary.movie_id == movie_id)

    result = await session.execute(stmt)

    return result.scalar_one()


async def count_movie_library_bulk(
    session: AsyncSession,
    movie_ids: list[int],
) -> dict[int, int]:
    if not movie_ids:
        return {}

    stmt = (
        select(
            MovieLibrary.movie_id,
            func.count(MovieLibrary.id),
        )
        .where(MovieLibrary.movie_id.in_(movie_ids))
        .group_by(MovieLibrary.movie_id)
    )

    result = await session.execute(stmt)

    return {movie_id: count for movie_id, count in result.all()}
