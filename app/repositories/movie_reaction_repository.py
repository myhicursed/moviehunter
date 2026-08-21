from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie_reaction import MovieReaction


async def get_user_movie_reaction(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> str | None:
    stmt = select(MovieReaction.reaction).where(
        MovieReaction.user_id == user_id,
        MovieReaction.movie_id == movie_id,
    )

    result = await session.execute(stmt)

    return result.scalar_one_or_none()


async def get_movie_reaction_counts(
    session: AsyncSession,
    movie_id: int,
) -> dict[str, int]:
    stmt = (
        select(
            MovieReaction.reaction,
            func.count(MovieReaction.id),
        )
        .where(MovieReaction.movie_id == movie_id)
        .group_by(MovieReaction.reaction)
    )

    result = await session.execute(stmt)

    counts = {
        "love": 0,
        "fire": 0,
        "funny": 0,
        "sad": 0,
        "wow": 0,
    }

    for reaction, count in result.all():
        if reaction in counts:
            counts[reaction] = count

    return counts


async def get_reaction_counts_for_movies(
    session: AsyncSession,
    movie_ids: list[int],
) -> dict[int, dict[str, int]]:
    if not movie_ids:
        return {}

    stmt = (
        select(
            MovieReaction.movie_id,
            MovieReaction.reaction,
            func.count(MovieReaction.id),
        )
        .where(MovieReaction.movie_id.in_(movie_ids))
        .group_by(
            MovieReaction.movie_id,
            MovieReaction.reaction,
        )
    )

    result = await session.execute(stmt)

    data: dict[int, dict[str, int]] = {}

    for movie_id, reaction, count in result.all():
        if movie_id not in data:
            data[movie_id] = {
                "love": 0,
                "fire": 0,
                "funny": 0,
                "sad": 0,
                "wow": 0,
            }

        if reaction in data[movie_id]:
            data[movie_id][reaction] = count

    return data


async def set_movie_reaction(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
    reaction: str,
) -> None:
    current_stmt = select(MovieReaction).where(
        MovieReaction.user_id == user_id,
        MovieReaction.movie_id == movie_id,
    )

    result = await session.execute(current_stmt)

    current = result.scalar_one_or_none()

    if current:
        current.reaction = reaction
    else:
        session.add(
            MovieReaction(
                user_id=user_id,
                movie_id=movie_id,
                reaction=reaction,
            )
        )

    await session.commit()


async def remove_movie_reaction(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
) -> None:
    stmt = delete(MovieReaction).where(
        MovieReaction.user_id == user_id,
        MovieReaction.movie_id == movie_id,
    )

    await session.execute(stmt)
    await session.commit()
