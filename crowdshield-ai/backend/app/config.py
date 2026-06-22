"""
CrowdShield AI — Application Configuration
Centralized settings via pydantic-settings with environment variable support.
"""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ─── Application ──────────────────────────────────────────
    APP_NAME: str = "CrowdShield AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # ─── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://crowdshield:crowdshield_secret@localhost:5432/crowdshield_db"

    # ─── Redis ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ─── Celery ───────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ─── CORS ─────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
    ]

    # ─── File Storage ─────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MODEL_DIR: str = "./models"
    MAX_UPLOAD_SIZE_MB: int = 500
    ALLOWED_VIDEO_EXTENSIONS: List[str] = [".mp4", ".avi", ".mov", ".mkv"]

    # ─── AI / Inference ───────────────────────────────────────
    YOLO_MODEL: str = "yolo11n.pt"
    YOLO_CONFIDENCE: float = 0.35
    YOLO_IOU_THRESHOLD: float = 0.45
    DEFAULT_PROCESSING_FPS: int = 10
    DEVICE: str = "auto"  # auto, cpu, cuda, mps

    # ─── MEC Configuration ────────────────────────────────────
    MEC_ENABLED: bool = False
    MEC_ENDPOINT: str = ""
    ADAPTIVE_FPS_SAFE: int = 5
    ADAPTIVE_FPS_MODERATE: int = 10
    ADAPTIVE_FPS_HIGH: int = 20
    ADAPTIVE_FPS_CRITICAL: int = 30

    # ─── Alert Thresholds ─────────────────────────────────────
    CRI_SAFE_MAX: int = 25
    CRI_MODERATE_MAX: int = 50
    CRI_HIGH_MAX: int = 75
    ALERT_MIN_CONFIRMATION_FRAMES: int = 5
    ALERT_PERSISTENCE_SECONDS: float = 3.0

    # ─── Security ─────────────────────────────────────────────
    SECRET_KEY: str = "crowdshield-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def model_path(self) -> Path:
        path = Path(self.MODEL_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
