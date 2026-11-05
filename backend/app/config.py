"""Application settings, loaded exclusively from environment variables.

No credentials are hard-coded here: every secret must be supplied via the
environment (see the project's .env.example).
"""
from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CINEBOOK"
    environment: str = "production"

    # Database
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str = "db"
    postgres_port: int = 5432

    # Auth
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Bootstrap admin account (created on first start if missing)
    admin_email: str
    admin_password: str = Field(min_length=8)
    admin_name: str = "CINEBOOK Administrator"

    seed_sample_data: bool = True
    app_timezone: str = "Asia/Kolkata"

    # Media uploads (movie posters)
    media_dir: str = "/app/media"
    media_url_prefix: str = "/media"
    max_upload_mb: int = 5

    # Booking rules
    convenience_fee_per_ticket: float = 30.0
    max_seats_per_booking: int = 10
    cancellation_cutoff_hours: float = 2.0
    full_refund_hours: float = 24.0
    partial_refund_percent: float = 50.0
    showtime_cleanup_minutes: int = 15

    cors_origins: str = "http://localhost"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{quote_plus(self.postgres_user)}:"
            f"{quote_plus(self.postgres_password)}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
