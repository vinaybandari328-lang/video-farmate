from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    heygen_api_key: str = ""
    heygen_default_avatar_id: str = ""
    heygen_default_voice_id: str = ""
    openai_api_key: str = ""

    output_dir: str = "./output"
    poll_interval_seconds: int = 5
    poll_timeout_seconds: int = 600


settings = Settings()
