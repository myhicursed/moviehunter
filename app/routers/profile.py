from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import AvatarUpdate, UserProfile, UserRead
from app.services.user_service import change_avatar, get_user_profile

router = APIRouter(prefix="/api/profile", tags=["Profile"])


@router.get("/me", response_model=UserProfile)
async def get_my_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_user_profile(session, current_user.id)


@router.get("/{user_id}", response_model=UserProfile)
async def get_profile(
    user_id: int,
    session: AsyncSession = Depends(get_session),
):
    return await get_user_profile(session, user_id)


@router.patch("/me/avatar", response_model=UserRead)
async def change_user_avatar(
    data: AvatarUpdate,
    session=Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await change_avatar(session, current_user.id, data.avatar)
