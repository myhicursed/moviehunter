from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie_stats import MovieStats


async def increment_movie_stats(
    session: AsyncSession,
    movie_id: int,
    is_correct: bool,
) -> None:
    stmt = insert(MovieStats).values(
        movie_id=movie_id,
        attempts=1,
        correct=1 if is_correct else 0,
    )

    stmt = stmt.on_conflict_do_update(
        index_elements=[MovieStats.movie_id],
        set_={
            "attempts": MovieStats.attempts + 1,
            "correct": MovieStats.correct + (1 if is_correct else 0),
            "updated_at": func.now(),
        },
    )

    await session.execute(stmt)


async def get_movie_stats(
    session: AsyncSession,
    movie_id: int,
) -> tuple[int, int]:
    stmt = select(
        MovieStats.attempts,
        MovieStats.correct,
    ).where(MovieStats.movie_id == movie_id)

    result = await session.execute(stmt)

    row = result.one_or_none()

    if not row:
        return 0, 0

    return row.attempts, row.correct


async def get_movie_stats_bulk(
    session: AsyncSession,
    movie_ids: list[int],
) -> dict[int, tuple[int, int]]:
    if not movie_ids:
        return {}

    stmt = select(
        MovieStats.movie_id,
        MovieStats.attempts,
        MovieStats.correct,
    ).where(MovieStats.movie_id.in_(movie_ids))

    result = await session.execute(stmt)

    return {
        movie_id: (
            attempts,
            correct,
        )
        for (
            movie_id,
            attempts,
            correct,
        ) in result.all()
    }
