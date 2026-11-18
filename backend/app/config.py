"""Configuration read from environment variables (never hard-code secrets)."""
import os

from dotenv import load_dotenv

load_dotenv()
# Also search parent/explicit backend directory for .env
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")))


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


class Config:
    """Default configuration. Override with environment variables or `create_app(overrides)`."""

    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
    UPLOAD_LIMIT_MB = _int("MAX_UPLOAD_MB", 5)
    MAX_CONTENT_LENGTH = UPLOAD_LIMIT_MB * 1024 * 1024
    UPSTREAM_TIMEOUT_S = _int("UPSTREAM_TIMEOUT_S", 10)
    AIR_CACHE_TTL_S = _int("AIR_CACHE_TTL_S", 600)
    RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "1") == "1"
    PORT = _int("PORT", 5000)
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
