from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    get_current_user_optional,
)
from app.db.database import get_session
from app.models.user import User
from app.repositories.stats_repository import (
    get_leaderboard,
    get_leaderboard_data,
)
from app.schemas.user import (
    LeaderboardEntry,
    LeaderboardResponse,
)

router = APIRouter(
    prefix="/api/leaderboard",
    tags=["Leaderboard"],
)


# ============================================
# СТАРЫЙ ENDPOINT
#
# Нужен главной странице.
# /api/leaderboard/?limit=10
# ============================================


@router.get(
    "/",
    response_model=list[LeaderboardEntry],
)
async def leaderboard(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(
        10,
        ge=1,
        le=100,
    ),
):
    return await get_leaderboard(
        session=session,
        limit=limit,
    )


# ============================================
# НОВЫЙ РАСШИРЕННЫЙ LEADERBOARD
# ============================================


@router.get(
    "/full",
    response_model=LeaderboardResponse,
)
async def full_leaderboard(
    period: str = Query(
        "week",
        pattern="^(week|all)$",
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
    ),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await get_leaderboard_data(
        session=session,
        period=period,
        limit=limit,
        current_user_id=(current_user.id if current_user else None),
    )
