from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    media_root: str = "media"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    admin_username: str
    admin_password: str
    environment: str = "dev"

    # НАСТРОЙКИ SMTP (почты)
    smtp_host: str = "smtp.yandex.ru"
    smtp_port: int = 465
    smtp_user: str = "moviehunterquiz@mail.ru"  # Твоя почта (например: no-reply@moviehunter.ru)
    smtp_password: str = ""  # Пароль приложений (НЕ обычный пароль!)
    smtp_from_email: str = "moviehunterquiz@mail.ru"  # От кого (обычно совпадает с smtp_user)

    # URL твоего сайта для формирования ссылки в письме
    site_url: str = "https://moviehunter.ru"

    class Config:
        env_file = ".env"


settings = Settings()  # type: ignore
