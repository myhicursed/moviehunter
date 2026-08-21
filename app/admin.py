import io
import os
import uuid
from datetime import datetime

from fastapi import Request
from PIL import Image, ImageOps, UnidentifiedImageError
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from wtforms import (
    FileField,
    Form,
    IntegerField,
    SelectField,
    StringField,
    validators,
)

from app.core.config import settings
from app.core.countries import COUNTRIES
from app.core.genres import GENRES
from app.db.database import engine
from app.models.daily_quiz import (
    DailyQuiz,
    DailyQuizAttempt,
    DailyQuizMovie,
)
from app.models.donation import Donation
from app.models.movie import Movie

# ============================================
# НАСТРОЙКИ ПОСТЕРОВ
# ============================================

POSTER_WIDTH = 1000
POSTER_HEIGHT = 1500
POSTER_QUALITY = 85

# Максимальный размер загружаемого постера — 15 МБ
MAX_POSTER_SIZE = 15 * 1024 * 1024

# Разрешённые форматы входного изображения
ALLOWED_POSTER_FORMATS = {
    "JPEG",
    "PNG",
    "WEBP",
}


# ============================================
# ОБРАБОТКА ПОСТЕРА
# ============================================


def process_poster(
    content: bytes,
    output_path: str,
) -> None:
    """
    Обрабатывает загруженный постер.

    - Проверяет размер файла
    - Проверяет формат
    - Исправляет EXIF orientation
    - Переводит изображение в RGB
    - Обрезает до пропорции 2:3
    - Изменяет размер до 1000x1500
    - Сохраняет в WebP quality=85
    """

    if not content:
        raise ValueError("Файл постера пустой.")

    if len(content) > MAX_POSTER_SIZE:
        raise ValueError("Постер слишком большой. " "Максимальный размер — 15 МБ.")

    try:
        with Image.open(io.BytesIO(content)) as original_image:
            original_format = original_image.format

            if original_format not in ALLOWED_POSTER_FORMATS:
                raise ValueError(
                    "Неподдерживаемый формат постера. " "Разрешены JPG, PNG и WebP."
                )

            # Исправляем ориентацию фотографии по EXIF
            image = ImageOps.exif_transpose(original_image)

            # Если есть прозрачность — кладём изображение
            # на тёмный фон.
            if image.mode in ("RGBA", "LA"):
                rgba = image.convert("RGBA")

                background = Image.new(
                    "RGBA",
                    rgba.size,
                    (15, 15, 18, 255),
                )

                background.alpha_composite(rgba)

                image = background.convert("RGB")

            elif image.mode == "P":
                # PNG с палитрой может содержать transparency
                if "transparency" in image.info:
                    rgba = image.convert("RGBA")

                    background = Image.new(
                        "RGBA",
                        rgba.size,
                        (15, 15, 18, 255),
                    )

                    background.alpha_composite(rgba)

                    image = background.convert("RGB")

                else:
                    image = image.convert("RGB")

            elif image.mode != "RGB":
                image = image.convert("RGB")

            # Приводим изображение к соотношению 2:3.
            # ImageOps.fit аккуратно обрезает лишнее
            # относительно центра изображения.
            image = ImageOps.fit(
                image,
                (
                    POSTER_WIDTH,
                    POSTER_HEIGHT,
                ),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )

            # Создаём директорию, если её ещё нет
            os.makedirs(
                os.path.dirname(output_path),
                exist_ok=True,
            )

            # Сохраняем всегда как WebP
            image.save(
                output_path,
                format="WEBP",
                quality=POSTER_QUALITY,
                method=6,
            )

    except UnidentifiedImageError as exc:
        raise ValueError("Загруженный файл не является изображением.") from exc


# ============================================
# АВТОРИЗАЦИЯ АДМИНКИ
# ============================================


class AdminAuth(AuthenticationBackend):

    async def login(
        self,
        request: Request,
    ) -> bool:
        form = await request.form()

        username = form.get("username")
        password = form.get("password")

        if username == settings.admin_username and password == settings.admin_password:
            request.session.update(
                {
                    "admin": True,
                }
            )

            return True

        return False

    async def logout(
        self,
        request: Request,
    ) -> bool:
        request.session.clear()

        return True

    async def authenticate(
        self,
        request: Request,
    ) -> bool:
        return request.session.get(
            "admin",
            False,
        )


# ============================================
# ФОРМА ФИЛЬМА
# ============================================


class MovieForm(Form):

    title = StringField(
        "Название",
        validators=[
            validators.DataRequired(),
            validators.Length(
                max=200,
            ),
        ],
    )

    year = IntegerField(
        "Год",
        validators=[
            validators.DataRequired(),
            validators.NumberRange(
                min=1900,
                max=datetime.now().year,
            ),
        ],
    )

    director = StringField(
        "Режиссёр",
        validators=[
            validators.Optional(),
            validators.Length(
                max=200,
            ),
        ],
    )

    genre = SelectField(
        "Жанр (основной)",
        choices=list(GENRES.items()),
        validators=[
            validators.DataRequired(),
        ],
    )

    genre_2 = SelectField(
        "Жанр 2 (опционально)",
        choices=[
            ("", "— нет —"),
        ]
        + list(GENRES.items()),
        validators=[
            validators.Optional(),
        ],
    )

    genre_3 = SelectField(
        "Жанр 3 (опционально)",
        choices=[
            ("", "— нет —"),
        ]
        + list(GENRES.items()),
        validators=[
            validators.Optional(),
        ],
    )

    difficulty = SelectField(
        "Сложность",
        choices=[
            (
                "easy",
                "Лёгкая",
            ),
            (
                "medium",
                "Средняя",
            ),
            (
                "hard",
                "Сложная",
            ),
        ],
        default="medium",
        validators=[
            validators.DataRequired(),
        ],
    )

    country = SelectField(
        "Страна",
        choices=list(COUNTRIES.items()),
        validators=[
            validators.DataRequired(),
        ],
    )

    file = FileField("Видеоотрывок")

    poster = FileField("Постер (JPG / PNG / WebP)")


# ============================================
# ФИЛЬМЫ
# ============================================


class MovieAdmin(
    ModelView,
    model=Movie,
):

    name = "Фильм"
    name_plural = "Фильмы"
    icon = "fa-solid fa-film"

    column_list = [
        Movie.id,
        Movie.title,
        Movie.year,
        Movie.genre,
        Movie.genre_2,
        Movie.genre_3,
        Movie.country,
        Movie.difficulty,
        Movie.director,
        Movie.created_at,
    ]

    column_searchable_list = [
        Movie.title,
        Movie.director,
        Movie.country,
    ]

    column_sortable_list = [
        Movie.id,
        Movie.year,
        Movie.created_at,
    ]

    column_labels = {
        Movie.id: "ID",
        Movie.title: "Название",
        Movie.year: "Год",
        Movie.director: "Режиссёр",
        Movie.genre: "Жанр",
        Movie.genre_2: "Жанр 2",
        Movie.genre_3: "Жанр 3",
        Movie.country: "Страна",
        Movie.difficulty: "Сложность",
        Movie.filename: "Видео",
        Movie.poster_filename: "Постер",
        Movie.created_at: "Загружен",
    }

    form = MovieForm

    async def on_model_change(
        self,
        data: dict,
        model: Movie,
        is_created: bool,
        request: Request,
    ) -> None:

        # ============================================
        # ВИДЕО
        # ============================================

        file = data.get("file")

        if (
            file
            and hasattr(
                file,
                "filename",
            )
            and file.filename
        ):
            ext = os.path.splitext(file.filename)[1].lower()

            unique_name = f"{uuid.uuid4()}{ext}"

            file_path = os.path.join(
                settings.media_root,
                "movies",
                unique_name,
            )

            os.makedirs(
                os.path.dirname(file_path),
                exist_ok=True,
            )

            content = await file.read()

            with open(
                file_path,
                "wb",
            ) as f:
                f.write(content)

            # Если при редактировании фильма
            # загружаем новое видео — запоминаем старое.
            old_filename = model.filename if not is_created else None

            model.filename = unique_name

            # Удаляем старое видео только после того,
            # как новое успешно сохранено.
            if old_filename and old_filename != unique_name:
                old_path = os.path.join(
                    settings.media_root,
                    "movies",
                    old_filename,
                )

                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                    except OSError:
                        pass

        # ============================================
        # ПОСТЕР
        # ============================================

        poster = data.get("poster")

        if (
            poster
            and hasattr(
                poster,
                "filename",
            )
            and poster.filename
        ):
            # Постер всегда сохраняем в WebP.
            unique_name = f"{uuid.uuid4()}.webp"

            poster_path = os.path.join(
                settings.media_root,
                "posters",
                unique_name,
            )

            # Сначала читаем загруженный файл.
            content = await poster.read()

            # Сначала полностью обрабатываем и
            # сохраняем новый файл.
            #
            # Если здесь возникнет ошибка,
            # старый постер не будет удалён.
            process_poster(
                content=content,
                output_path=poster_path,
            )

            # Запоминаем старый постер.
            old_poster = model.poster_filename if not is_created else None

            # Записываем новое имя в модель.
            model.poster_filename = unique_name

            # Старый постер больше не нужен.
            if old_poster and old_poster != unique_name:
                old_path = os.path.join(
                    settings.media_root,
                    "posters",
                    old_poster,
                )

                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                    except OSError:
                        pass

    async def on_model_delete(
        self,
        model: Movie,
        request: Request,
    ) -> None:

        # ============================================
        # УДАЛЯЕМ ВИДЕО
        # ============================================

        if model.filename:
            path = os.path.join(
                settings.media_root,
                "movies",
                model.filename,
            )

            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

        # ============================================
        # УДАЛЯЕМ ПОСТЕР
        # ============================================

        if model.poster_filename:
            path = os.path.join(
                settings.media_root,
                "posters",
                model.poster_filename,
            )

            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


# ============================================
# ЕЖЕДНЕВНЫЙ КВИЗ
# ============================================


class DailyQuizAdmin(
    ModelView,
    model=DailyQuiz,
):

    name = "Квиз дня"
    name_plural = "Квизы дня"
    icon = "fa-solid fa-calendar-day"
    category = "Ежедневные"

    column_list = [
        DailyQuiz.id,
        DailyQuiz.date,
        DailyQuiz.bonus_points,
        DailyQuiz.perfect_bonus,
        DailyQuiz.created_at,
    ]

    column_labels = {
        DailyQuiz.id: "ID",
        DailyQuiz.date: "Дата",
        DailyQuiz.bonus_points: "Бонус за прохождение",
        DailyQuiz.perfect_bonus: "Бонус за 100%",
        DailyQuiz.created_at: "Создан",
    }

    column_sortable_list = [
        DailyQuiz.date,
        DailyQuiz.created_at,
    ]

    column_default_sort = [
        (
            DailyQuiz.date,
            True,
        ),
    ]

    form_columns = [
        DailyQuiz.date,
        DailyQuiz.bonus_points,
        DailyQuiz.perfect_bonus,
    ]


# ============================================
# ФИЛЬМЫ В ЕЖЕДНЕВНОМ КВИЗЕ
# ============================================


class DailyQuizMovieAdmin(
    ModelView,
    model=DailyQuizMovie,
):

    name = "Фильм в квизе"
    name_plural = "Фильмы в квизах"
    icon = "fa-solid fa-film"
    category = "Ежедневные"

    column_list = [
        DailyQuizMovie.id,
        DailyQuizMovie.daily_quiz,
        DailyQuizMovie.movie,
        DailyQuizMovie.order,
    ]

    column_labels = {
        DailyQuizMovie.id: "ID",
        DailyQuizMovie.daily_quiz: "Квиз дня",
        DailyQuizMovie.movie: "Фильм",
        DailyQuizMovie.order: "Порядок",
    }

    column_sortable_list = [
        DailyQuizMovie.order,
    ]

    form_columns = [
        DailyQuizMovie.daily_quiz,
        DailyQuizMovie.movie,
        DailyQuizMovie.order,
    ]


# ============================================
# ПОПЫТКИ ЕЖЕДНЕВНОГО КВИЗА
# ============================================


class DailyQuizAttemptAdmin(
    ModelView,
    model=DailyQuizAttempt,
):

    name = "Попытка"
    name_plural = "Попытки прохождения"
    icon = "fa-solid fa-list-check"
    category = "Ежедневные"

    column_list = [
        DailyQuizAttempt.id,
        DailyQuizAttempt.user,
        DailyQuizAttempt.daily_quiz,
        DailyQuizAttempt.correct_count,
        DailyQuizAttempt.bonus_earned,
        DailyQuizAttempt.is_completed,
        DailyQuizAttempt.completed_at,
    ]

    column_labels = {
        DailyQuizAttempt.id: "ID",
        DailyQuizAttempt.user: "Юзер",
        DailyQuizAttempt.daily_quiz: "Квиз дня",
        DailyQuizAttempt.correct_count: "Правильных",
        DailyQuizAttempt.bonus_earned: "Бонус",
        DailyQuizAttempt.is_completed: "Завершён",
        DailyQuizAttempt.completed_at: "Дата завершения",
    }

    can_create = False
    can_edit = False
    can_delete = True


# ============================================
# ДОНАТЫ
# ============================================


class DonationAdmin(
    ModelView,
    model=Donation,
):

    name = "Донат"
    name_plural = "Донаты"
    icon = "fa-solid fa-heart"
    category = "Поддержка"

    column_list = [
        Donation.id,
        Donation.nickname,
        Donation.amount,
        Donation.message,
        Donation.created_at,
    ]

    column_labels = {
        Donation.id: "ID",
        Donation.nickname: "Ник донатера",
        Donation.amount: "Сумма (₽)",
        Donation.message: "Сообщение",
        Donation.created_at: "Дата",
    }

    column_sortable_list = [
        Donation.id,
        Donation.amount,
        Donation.created_at,
    ]

    column_default_sort = [
        (
            Donation.created_at,
            True,
        ),
    ]

    column_searchable_list = [
        Donation.nickname,
    ]

    form_columns = [
        Donation.nickname,
        Donation.amount,
        Donation.message,
    ]


# ============================================
# ИНИЦИАЛИЗАЦИЯ ADMIN
# ============================================


def setup_admin(app):

    authentication_backend = AdminAuth(secret_key=settings.secret_key)

    admin = Admin(
        app,
        engine,
        authentication_backend=authentication_backend,
    )

    admin.add_view(MovieAdmin)

    admin.add_view(DailyQuizAdmin)

    admin.add_view(DailyQuizMovieAdmin)

    admin.add_view(DailyQuizAttemptAdmin)

    admin.add_view(DonationAdmin)

    return admin
