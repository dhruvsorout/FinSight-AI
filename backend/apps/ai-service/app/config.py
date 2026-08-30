from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 8000
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
