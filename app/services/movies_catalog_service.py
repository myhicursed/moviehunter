import math

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.genres import GENRES
from app.models.user import User
from app.repositories.library_repository import (
    count_movie_library,
    count_movie_library_bulk,
    is_movie_in_library,
)
from app.repositories.movie_reaction_repository import (
    get_movie_reaction_counts,
    get_reaction_counts_for_movies,
    get_user_movie_reaction,
    remove_movie_reaction,
    set_movie_reaction,
)
from app.repositories.movie_repository import (
    get_catalog_movies,
    get_movie_by_id,
)
from app.repositories.movie_stats_repository import (
    get_movie_stats,
    get_movie_stats_bulk,
)
from app.schemas.movies_catalog import (
    MovieCatalogItem,
    MovieCatalogResponse,
    MovieCommunityStats,
    MovieDetail,
    ReactionCounts,
    ReactionResponse,
)

ALLOWED_REACTIONS = {
    "love",
    "fire",
    "funny",
    "sad",
    "wow",
}


def build_community_stats(
    attempts: int,
    correct: int,
    want_to_watch: int,
) -> MovieCommunityStats:
    guessed_percent = None

    if attempts > 0:
        guessed_percent = round(
            (correct / attempts) * 100,
            1,
        )

    return MovieCommunityStats(
        attempts=attempts,
        guessed_percent=guessed_percent,
        want_to_watch=want_to_watch,
    )


def get_movie_genres(movie) -> list[str]:
    result = []

    for genre in [
        movie.genre,
        movie.genre_2,
        movie.genre_3,
    ]:
        if genre and genre not in result:
            result.append(
                GENRES.get(
                    genre,
                    genre,
                )
            )

    return result


def get_poster_url(movie) -> str | None:
    if not movie.poster_filename:
        return None

    return f"/media/posters/" f"{movie.poster_filename}"


async def get_movies_catalog(
    session: AsyncSession,
    page: int,
    limit: int,
    search: str | None,
    genre: str | None,
) -> MovieCatalogResponse:
    movies, total = await get_catalog_movies(
        session=session,
        page=page,
        limit=limit,
        search=search,
        genre=genre,
    )

    movie_ids = [movie.id for movie in movies]

    reactions_map = await get_reaction_counts_for_movies(
        session,
        movie_ids,
    )

    stats_map = await get_movie_stats_bulk(
        session,
        movie_ids,
    )

    library_count_map = await count_movie_library_bulk(
        session,
        movie_ids,
    )

    items = []

    for movie in movies:
        counts = reactions_map.get(
            movie.id,
            {
                "love": 0,
                "fire": 0,
                "funny": 0,
                "sad": 0,
                "wow": 0,
            },
        )

        attempts, correct = stats_map.get(
            movie.id,
            (0, 0),
        )

        want_to_watch = library_count_map.get(
            movie.id,
            0,
        )

        items.append(
            MovieCatalogItem(
                id=movie.id,
                title=movie.title,
                year=movie.year,
                director=movie.director,
                genres=get_movie_genres(movie),
                poster_url=get_poster_url(movie),
                reactions=ReactionCounts(**counts),
                stats=build_community_stats(
                    attempts=attempts,
                    correct=correct,
                    want_to_watch=want_to_watch,
                ),
            )
        )

    pages = math.ceil(total / limit) if total else 0

    return MovieCatalogResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
        pages=pages,
    )


async def get_movie_detail(
    session: AsyncSession,
    movie_id: int,
    current_user: User | None,
) -> MovieDetail:
    movie = await get_movie_by_id(
        session,
        movie_id,
    )

    if not movie:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден",
        )

    reaction_counts = await get_movie_reaction_counts(
        session,
        movie_id,
    )

    attempts, correct = await get_movie_stats(
        session,
        movie_id,
    )

    want_to_watch = await count_movie_library(
        session,
        movie_id,
    )

    user_reaction = None
    in_library = None

    if current_user:
        user_reaction = await get_user_movie_reaction(
            session,
            current_user.id,
            movie_id,
        )

        in_library = await is_movie_in_library(
            session,
            current_user.id,
            movie_id,
        )

    return MovieDetail(
        id=movie.id,
        title=movie.title,
        year=movie.year,
        director=movie.director,
        genres=get_movie_genres(movie),
        poster_url=get_poster_url(movie),
        reactions=ReactionCounts(**reaction_counts),
        user_reaction=user_reaction,
        in_library=in_library,
        stats=build_community_stats(
            attempts=attempts,
            correct=correct,
            want_to_watch=want_to_watch,
        ),
    )


async def react_to_movie(
    session: AsyncSession,
    movie_id: int,
    user: User,
    reaction: str,
) -> ReactionResponse:
    movie = await get_movie_by_id(
        session,
        movie_id,
    )

    if not movie:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден",
        )

    if reaction not in ALLOWED_REACTIONS:
        raise HTTPException(
            status_code=400,
            detail="Неизвестная реакция",
        )

    current = await get_user_movie_reaction(
        session,
        user.id,
        movie_id,
    )

    # Повторное нажатие снимает реакцию
    if current == reaction:
        await remove_movie_reaction(
            session,
            user.id,
            movie_id,
        )

        user_reaction = None

    else:
        await set_movie_reaction(
            session,
            user.id,
            movie_id,
            reaction,
        )

        user_reaction = reaction

    counts = await get_movie_reaction_counts(
        session,
        movie_id,
    )

    return ReactionResponse(
        movie_id=movie_id,
        user_reaction=user_reaction,
        reactions=ReactionCounts(**counts),
    )
