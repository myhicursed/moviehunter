from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.schemas.featured_movie import (
    FeaturedMovieResponse,
)
from app.services.featured_movie_service import (
    get_featured_movie_today,
)

router = APIRouter(
    prefix="/api/featured",
    tags=["Featured movie"],
)


@router.get(
    "/today",
    response_model=(FeaturedMovieResponse | None),
)
async def featured_today(
    session: AsyncSession = Depends(get_session),
):
    return await get_featured_movie_today(session)
