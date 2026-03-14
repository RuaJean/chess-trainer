import os


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://chess:chess@db:5432/chess_trainer",
)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
