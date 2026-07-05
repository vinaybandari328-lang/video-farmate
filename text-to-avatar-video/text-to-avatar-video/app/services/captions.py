import httpx
from app.config import settings

OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"


async def generate_srt(video_path: str, srt_dest_path: str) -> str:
    """
    Sends the video file to OpenAI's Whisper transcription endpoint and
    requests an .srt subtitle file back. Requires OPENAI_API_KEY.
    """
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set -- required for burn_captions=True")

    async with httpx.AsyncClient(timeout=120) as client:
        with open(video_path, "rb") as f:
            resp = await client.post(
                OPENAI_TRANSCRIBE_URL,
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files={"file": (video_path, f, "video/mp4")},
                data={"model": "whisper-1", "response_format": "srt"},
            )
        resp.raise_for_status()
        srt_text = resp.text

    with open(srt_dest_path, "w", encoding="utf-8") as f:
        f.write(srt_text)

    return srt_dest_path
