from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.repositories.stats_repository import get_leaderboard
from app.schemas.user import LeaderboardEntry

router = APIRouter(prefix="/api/leaderboard", tags=["Leaderboard"])


@router.get("/", response_model=list[LeaderboardEntry])
async def leaderboard(
    session: AsyncSession = Depends(get_session),
    limit: int = 10,
):
    return await get_leaderboard(session, limit)
