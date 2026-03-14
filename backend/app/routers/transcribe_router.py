import io
import wave

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from ..dependencies import get_current_user
from ..models import User
from ..schemas import TranscribeOut

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

# Whisper model is loaded at app startup via lifespan and stored here
whisper_model = None


def set_whisper_model(model):
    global whisper_model
    whisper_model = model


@router.post("/", response_model=TranscribeOut)
async def transcribe(
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    if whisper_model is None:
        raise HTTPException(503, "Whisper model not loaded yet")

    content = await file.read()

    try:
        # Parse WAV to get raw audio samples
        with io.BytesIO(content) as buf:
            with wave.open(buf, "rb") as wf:
                n_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                framerate = wf.getframerate()
                n_frames = wf.getnframes()
                raw = wf.readframes(n_frames)

        # Convert to float32 numpy array
        if sample_width == 2:
            audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 4:
            audio = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            audio = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

        # Mix to mono if stereo
        if n_channels > 1:
            audio = audio.reshape(-1, n_channels).mean(axis=1)

        # Resample to 16kHz if needed
        if framerate != 16000:
            from scipy.signal import resample
            num_samples = int(len(audio) * 16000 / framerate)
            audio = resample(audio, num_samples).astype(np.float32)

    except Exception:
        # If WAV parsing fails, try passing raw bytes (faster-whisper can handle some formats)
        audio = content

    segments, _ = whisper_model.transcribe(
        audio, language="es", task="transcribe", beam_size=5,
        vad_filter=True,
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return TranscribeOut(text=text)
