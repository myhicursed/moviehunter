from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    get_current_user,
    get_current_user_optional,
)
from app.db.database import get_session
from app.models.user import User
from app.schemas.movies_catalog import (
    MovieCatalogResponse,
    MovieDetail,
    ReactionRequest,
    ReactionResponse,
)
from app.services.movies_catalog_service import (
    get_movie_detail,
    get_movies_catalog,
    react_to_movie,
)

router = APIRouter(
    prefix="/api/movies",
    tags=["Movies"],
)


@router.get(
    "",
    response_model=MovieCatalogResponse,
)
async def catalog(
    page: int = Query(
        1,
        ge=1,
    ),
    limit: int = Query(
        24,
        ge=1,
        le=60,
    ),
    search: str | None = None,
    genre: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    return await get_movies_catalog(
        session=session,
        page=page,
        limit=limit,
        search=search,
        genre=genre,
    )


@router.get(
    "/{movie_id}",
    response_model=MovieDetail,
)
async def movie_detail(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await get_movie_detail(
        session=session,
        movie_id=movie_id,
        current_user=current_user,
    )


@router.post(
    "/{movie_id}/reaction",
    response_model=ReactionResponse,
)
async def movie_reaction(
    movie_id: int,
    data: ReactionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await react_to_movie(
        session=session,
        movie_id=movie_id,
        user=current_user,
        reaction=data.reaction,
    )
