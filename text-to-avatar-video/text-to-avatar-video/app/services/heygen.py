import asyncio
import httpx
from app.config import settings

HEYGEN_GENERATE_URL = "https://api.heygen.com/v2/video/generate"
HEYGEN_STATUS_URL = "https://api.heygen.com/v1/video_status.get"


class HeyGenError(RuntimeError):
    pass


async def create_avatar_video(script: str, avatar_id: str, voice_id: str) -> str:
    """
    Submits a text-to-avatar-video render job to HeyGen.
    Returns the HeyGen video_id, which is used to poll for status.
    """
    if not settings.heygen_api_key:
        raise HeyGenError("HEYGEN_API_KEY is not set in the environment")

    payload = {
        "video_inputs": [
            {
                "character": {
                    "type": "avatar",
                    "avatar_id": avatar_id,
                    "avatar_style": "normal",
                },
                "voice": {
                    "type": "text",
                    "input_text": script,
                    "voice_id": voice_id,
                },
            }
        ],
        # 1080x1920 = vertical master render; we re-crop/export per platform later
        "dimension": {"width": 1080, "height": 1920},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            HEYGEN_GENERATE_URL,
            headers={
                "X-Api-Key": settings.heygen_api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code >= 400:
            raise HeyGenError(f"HeyGen generate failed: {resp.status_code} {resp.text}")
        data = resp.json()

    video_id = data.get("data", {}).get("video_id")
    if not video_id:
        raise HeyGenError(f"HeyGen response missing video_id: {data}")
    return video_id


async def wait_for_video(video_id: str) -> str:
    """
    Polls HeyGen until the render finishes. Returns the downloadable video URL.
    Raises HeyGenError on failure or timeout.
    """
    elapsed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < settings.poll_timeout_seconds:
            resp = await client.get(
                HEYGEN_STATUS_URL,
                headers={"X-Api-Key": settings.heygen_api_key},
                params={"video_id": video_id},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            status = data.get("status")

            if status == "completed":
                return data["video_url"]
            if status == "failed":
                raise HeyGenError(f"HeyGen render failed: {data.get('error')}")

            await asyncio.sleep(settings.poll_interval_seconds)
            elapsed += settings.poll_interval_seconds

    raise HeyGenError(f"Timed out waiting for HeyGen video {video_id}")


async def download_video(video_url: str, dest_path: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
    return dest_path
