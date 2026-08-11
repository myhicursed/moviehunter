from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_current_user
from app.db.database import get_session
from app.models.user import User
from app.schemas.user import Token, UserLogin, UserRead, UserRegister
from app.services.user_service import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead)
async def register(data: UserRegister, session=Depends(get_session)):
    user = await register_user(
        session,
        data.username,
        data.password,
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    data: UserLogin,
    session: AsyncSession = Depends(get_session),
):
    user = await authenticate_user(session, data.username, data.password)
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
