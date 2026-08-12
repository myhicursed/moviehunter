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

    class Config:
        env_file = ".env"


settings = Settings()  # type: ignore
