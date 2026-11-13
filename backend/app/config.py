from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "food_donation"
    DB_SSL_CA: str = ""

    SECRET_KEY: str = "dev-secret-change-me"
    FRONTEND_URL: str = "http://localhost:5173"
    DEV_MODE: bool = True
    ACCESS_TOKEN_DAYS: int = 7
    OTP_EXPIRE_MIN: int = 10

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = ""
    BREVO_SENDER_NAME: str = "Food Donation Platform"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def cors_origins(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.FRONTEND_URL.split(",") if o.strip()]
        for extra in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if extra not in origins:
                origins.append(extra)
        return origins


settings = Settings()
