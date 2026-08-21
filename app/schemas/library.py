from datetime import datetime

from pydantic import BaseModel


class LibraryMovie(BaseModel):
    movie_id: int
    title: str
    year: int
    poster_url: str | None
    added_at: datetime


class LibraryState(BaseModel):
    movie_id: int
    in_library: bool
