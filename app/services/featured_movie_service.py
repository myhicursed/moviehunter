from sqlalchemy.ext.asyncio import AsyncSession

from app.core.genres import GENRES
from app.core.timezone import today_moscow
from app.repositories.featured_movie_repository import (
    get_featured_movie_by_date,
)
from app.repositories.library_repository import (
    count_movie_library,
)
from app.repositories.movie_reaction_repository import (
    get_movie_reaction_counts,
)
from app.repositories.movie_stats_repository import (
    get_movie_stats,
)
from app.schemas.featured_movie import (
    FeaturedMovieResponse,
)
from app.schemas.movies_catalog import (
    MovieCommunityStats,
    ReactionCounts,
)


def get_genres(movie) -> list[str]:

    result = []

    for code in (
        movie.genre,
        movie.genre_2,
        movie.genre_3,
    ):

        if code and code not in result:

            result.append(
                GENRES.get(
                    code,
                    code,
                )
            )

    return result


def get_poster_url(
    movie,
) -> str | None:

    if not movie.poster_filename:
        return None

    return f"/media/posters/" f"{movie.poster_filename}"


async def get_featured_movie_today(
    session: AsyncSession,
) -> FeaturedMovieResponse | None:

    featured = await get_featured_movie_by_date(
        session,
        today_moscow(),
    )

    if not featured:
        return None

    movie = featured.movie

    reactions = await get_movie_reaction_counts(
        session,
        movie.id,
    )

    attempts, correct = await get_movie_stats(
        session,
        movie.id,
    )

    want_to_watch = await count_movie_library(
        session,
        movie.id,
    )

    guessed_percent = None

    if attempts > 0:
        guessed_percent = round(
            correct / attempts * 100,
            1,
        )

    return FeaturedMovieResponse(
        movie_id=movie.id,
        title=movie.title,
        year=movie.year,
        director=movie.director,
        genres=get_genres(movie),
        poster_url=get_poster_url(movie),
        reactions=ReactionCounts(**reactions),
        stats=MovieCommunityStats(
            attempts=attempts,
            guessed_percent=guessed_percent,
            want_to_watch=want_to_watch,
        ),
    )
