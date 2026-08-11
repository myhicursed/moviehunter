from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.repositories.donation_repository import get_top_donations

router = APIRouter(prefix="/api/donations", tags=["Donations"])


class DonationEntry(BaseModel):
    nickname: str
    total_amount: int
    donations_count: int
    last_message: str | None = None  # ← добавь


@router.get("/top", response_model=list[DonationEntry])
async def top_donations(
    session: AsyncSession = Depends(get_session),
    limit: int = 20,
):
    return await get_top_donations(session, limit)
