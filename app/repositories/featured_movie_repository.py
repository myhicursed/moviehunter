from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.featured_movie import FeaturedMovie


async def get_featured_movie_by_date(
    session: AsyncSession,
    target_date: date,
) -> FeaturedMovie | None:

    stmt = select(FeaturedMovie).where(FeaturedMovie.date == target_date)

    result = await session.execute(stmt)

    return result.scalar_one_or_none()


async def is_featured_movie(
    session: AsyncSession,
    movie_id: int,
    target_date: date,
) -> bool:

    stmt = (
        select(FeaturedMovie.id)
        .where(
            FeaturedMovie.date == target_date,
            FeaturedMovie.movie_id == movie_id,
        )
        .limit(1)
    )

    result = await session.execute(stmt)

    return result.scalar_one_or_none() is not None
