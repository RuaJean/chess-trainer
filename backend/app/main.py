import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import WHISPER_MODEL
from .database import Base, engine
from .routers import (
    auth_router,
    collections_router,
    games_router,
    lichess_router,
    settings_router,
    tags_router,
    transcribe_router,
)

logger = logging.getLogger("chess-trainer")


def _load_whisper():
    """Load Whisper model synchronously (called in a thread)."""
    try:
        from faster_whisper import WhisperModel

        logger.info(f"Loading Whisper model: {WHISPER_MODEL}")
        model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=4)
        transcribe_router.set_whisper_model(model)
        logger.info("Whisper model loaded")
    except Exception as e:
        logger.warning(f"Whisper model failed to load (transcription will be unavailable): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")

    # Load Whisper model in background thread (don't block server startup)
    asyncio.get_event_loop().run_in_executor(None, _load_whisper)

    yield


app = FastAPI(title="Chess Trainer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost", "http://localhost:8888"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(collections_router.router)
app.include_router(games_router.router)
app.include_router(tags_router.router)
app.include_router(settings_router.router)
app.include_router(transcribe_router.router)
app.include_router(lichess_router.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
