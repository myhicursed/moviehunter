from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_current_user_optional
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import (
    AvatarUpdate,
    UserEmailUpdate,
    UserPasswordUpdate,
    UserProfile,
    UserRead,
)
from app.services.user_service import (
    change_avatar,
    change_email,
    change_password,
    get_user_profile,
)

router = APIRouter(prefix="/api/profile", tags=["Profile"])


@router.get("/me", response_model=UserProfile)
async def get_my_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_user_profile(
        session, current_user.id, requester_id=current_user.id
    )


@router.get("/{user_id}", response_model=UserProfile)
async def get_profile(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    requester_id = current_user.id if current_user else None
    return await get_user_profile(session, user_id, requester_id=requester_id)


@router.patch("/me/avatar", response_model=UserRead)
async def change_user_avatar(
    data: AvatarUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await change_avatar(session, current_user.id, data.avatar)


@router.patch("/me/email", response_model=UserProfile)
async def update_user_email(
    data: UserEmailUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await change_email(session, current_user.id, data.email)


@router.patch("/me/password")
async def update_user_password(
    data: UserPasswordUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await change_password(
        session, current_user.id, data.old_password, data.new_password
    )
