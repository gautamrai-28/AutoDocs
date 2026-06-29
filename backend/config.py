from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # AI provider — Groq is the active provider for this project.
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    frontend_origin: str = "http://localhost:5173"
    host: str = "0.0.0.0"
    port: int = 8000
    max_repo_size_mb: int = 50
    max_files_to_analyse: int = 15
    job_ttl_seconds: int = 3600
    env: str = "development"

    @property
    def is_development(self) -> bool:
        return self.env.lower() == "development"

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

settings = Settings()