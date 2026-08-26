from pydantic import BaseModel

from app.schemas.movies_catalog import (
    MovieCommunityStats,
    ReactionCounts,
)


class FeaturedMovieResponse(BaseModel):
    movie_id: int

    title: str

    year: int

    director: str | None

    genres: list[str]

    poster_url: str | None

    reactions: ReactionCounts

    stats: MovieCommunityStats
