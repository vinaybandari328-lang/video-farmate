import httpx
from app.config import settings

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-sonnet-4-5"

# Rough average speaking pace, used to size the script to the requested length
WORDS_PER_SECOND = 2.5


async def generate_script(topic: str, target_seconds: int) -> str:
    """
    Calls the Anthropic API to write a short, natural-sounding narration
    script for a talking-avatar video on the given topic.

    Returns plain narration text with no stage directions, ready to be
    sent straight to the avatar API as spoken audio.
    """
    target_words = int(target_seconds * WORDS_PER_SECOND)

    system_prompt = (
        "You write short, punchy narration scripts for social video "
        "(YouTube Shorts / Instagram Reels style). Output ONLY the words "
        "that should be spoken aloud -- no stage directions, no headers, "
        "no emojis, no asterisks. Sentences should be short and easy to "
        "say out loud. Hook the viewer in the first sentence."
    )
    user_prompt = (
        f"Topic: {topic}\n"
        f"Target length: about {target_words} words "
        f"(~{target_seconds} seconds spoken aloud).\n"
        "Write the narration script now."
    )

    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set in the environment")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    script_text = "".join(
        block["text"] for block in data["content"] if block.get("type") == "text"
    ).strip()

    return script_text
