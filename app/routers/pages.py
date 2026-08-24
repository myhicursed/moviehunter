from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
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


@router.get(
    "/films",
    response_class=HTMLResponse,
)
async def films_page(
    request: Request,
):
    return templates.TemplateResponse(
        request=request,
        name="films.html",
    )


@router.get(
    "/film/{movie_id}",
    response_class=HTMLResponse,
)
async def film_page(
    request: Request,
    movie_id: int,
):
    return templates.TemplateResponse(
        request=request,
        name="film.html",
        context={
            "movie_id": movie_id,
        },
    )


@router.get("/leaderboard", response_class=HTMLResponse)
async def leaderboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="leaderboard.html",
    )


@router.get("/googled9c1001d54eddc0e.html", include_in_schema=False)
async def google_verification():
    return FileResponse("app/static/googled9c1001d54eddc0e.html")


@router.get("/sitemap.xml", response_class=Response)
async def sitemap():
    """Карта сайта для поисковиков."""
    urls = [
        {"loc": "https://moviehunter.ru/", "priority": "1.0", "changefreq": "daily"},
        {
            "loc": "https://moviehunter.ru/quiz",
            "priority": "0.9",
            "changefreq": "daily",
        },
        {
            "loc": "https://moviehunter.ru/quiz?mode=daily",
            "priority": "0.9",
            "changefreq": "daily",
        },
        {
            "loc": "https://moviehunter.ru/quiz?mode=letters",
            "priority": "0.8",
            "changefreq": "weekly",
        },
        {
            "loc": "https://moviehunter.ru/about",
            "priority": "0.5",
            "changefreq": "monthly",
        },
        {
            "loc": "https://moviehunter.ru/support",
            "priority": "0.4",
            "changefreq": "monthly",
        },
        {
            "loc": "https://moviehunter.ru/terms",
            "priority": "0.3",
            "changefreq": "yearly",
        },
        {
            "loc": "https://moviehunter.ru/privacy",
            "priority": "0.3",
            "changefreq": "yearly",
        },
        {
            "loc": "https://moviehunter.ru/copyright",
            "priority": "0.3",
            "changefreq": "yearly",
        },
    ]

    today = datetime.now().strftime("%Y-%m-%d")

    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for url in urls:
        xml_content += "  <url>\n"
        xml_content += f"    <loc>{url['loc']}</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += f"    <changefreq>{url['changefreq']}</changefreq>\n"
        xml_content += f"    <priority>{url['priority']}</priority>\n"
        xml_content += "  </url>\n"

    xml_content += "</urlset>"

    return Response(content=xml_content, media_type="application/xml")
