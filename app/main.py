from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.admin import setup_admin
from app.core.config import settings
from app.routers import auth, donations, leaderboard, pages, profile, quiz

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Cinema Quiz")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
)

app.include_router(quiz.router)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(leaderboard.router)
app.include_router(pages.router)
app.include_router(donations.router)

setup_admin(app)

# Медиа-файлы
app.mount("/media", StaticFiles(directory=settings.media_root), name="media")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
