"""
Groq Whisper Voice Transcription
Uses whisper-large-v3-turbo via Groq API for Hindi/English speech-to-text
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
import httpx
import os
import tempfile

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
WHISPER_MODEL = "whisper-large-v3-turbo"


class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration: float


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio file using Groq Whisper API.
    Accepts WebM, WAV, MP3, etc.
    """
    audio_bytes = await audio.read()

    # Save to temp file (Groq API needs a file)
    suffix = ".webm" if "webm" in (audio.content_type or "") else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(tmp_path, "rb") as f:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    data={
                        "model": WHISPER_MODEL,
                        "language": "hi",
                        "response_format": "verbose_json",
                    },
                    files={"file": (audio.filename or "audio.webm", f, audio.content_type or "audio/webm")},
                )

            if response.status_code == 200:
                data = response.json()
                return TranscribeResponse(
                    text=data.get("text", ""),
                    language=data.get("language", "hi"),
                    duration=data.get("duration", 0.0),
                )
            else:
                print(f"Whisper API error: {response.status_code} - {response.text}")
                return TranscribeResponse(text="", language="hi", duration=0.0)
    except Exception as e:
        print(f"Whisper API connection error: {e}")
        return TranscribeResponse(text="", language="hi", duration=0.0)
    finally:
        os.unlink(tmp_path)
