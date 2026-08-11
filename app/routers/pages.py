from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

router = APIRouter(tags=["Pages"])


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


@router.get("/quiz", response_class=HTMLResponse)
async def quiz_page(request: Request, mode: str | None = None):
    # Для режима букв — отдельный шаблон
    if mode == "letters":
        template = "quiz_letters.html"
    else:
        template = "quiz.html"

    return templates.TemplateResponse(
        request=request,
        name=template,
    )


@router.get("/profile", response_class=HTMLResponse)
async def my_profile_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="profile.html",
        context={"user_id": None},  # None = свой профиль
    )


@router.get("/profile/{user_id}", response_class=HTMLResponse)
async def user_profile_page(request: Request, user_id: int):
    return templates.TemplateResponse(
        request=request,
        name="profile.html",
        context={"user_id": user_id},  # ID = чужой профиль
    )


@router.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="terms.html",
    )


@router.get("/support", response_class=HTMLResponse)
async def support_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="support.html",
    )


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="privacy.html",
    )


@router.get("/copyright", response_class=HTMLResponse)
async def copyright_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="copyright.html",
    )


@router.get("/about", response_class=HTMLResponse)
async def about_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="about.html",
    )
