from pydantic import BaseModel


class MovieCommunityStats(BaseModel):
    attempts: int = 0
    guessed_percent: float | None = None
    want_to_watch: int = 0


class ReactionCounts(BaseModel):
    love: int = 0
    fire: int = 0
    funny: int = 0
    sad: int = 0
    wow: int = 0


class MovieCatalogItem(BaseModel):
    id: int
    title: str
    year: int
    director: str | None
    genres: list[str]
    poster_url: str | None
    reactions: ReactionCounts

    stats: MovieCommunityStats
    is_featured_movie: bool = False


class MovieCatalogResponse(BaseModel):
    items: list[MovieCatalogItem]
    page: int
    limit: int
    total: int
    pages: int


class MovieDetail(BaseModel):
    id: int
    title: str
    year: int
    director: str | None
    genres: list[str]
    poster_url: str | None

    reactions: ReactionCounts
    stats: MovieCommunityStats

    user_reaction: str | None = None
    in_library: bool | None = None
    is_featured_movie: bool = False


class ReactionRequest(BaseModel):
    reaction: str


class ReactionResponse(BaseModel):
    movie_id: int
    user_reaction: str | None
    reactions: ReactionCounts
