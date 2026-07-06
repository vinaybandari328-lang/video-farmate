import os
import asyncio
import edge_tts
import imageio_ffmpeg

# Configure MoviePy to use the ffmpeg from imageio_ffmpeg
# We must do this before importing other moviepy modules if possible,
# or set the environment variable.
os.environ["FFMPEG_BINARY"] = imageio_ffmpeg.get_ffmpeg_exe()

from moviepy import ColorClip, TextClip, AudioFileClip, CompositeVideoClip
from app.config import settings

async def generate_free_video(script: str, dest_path: str) -> str:
    """
    Generates a video using free tools:
    1. edge-tts for speech generation.
    2. MoviePy for simple video generation (text on background).
    """
    # 1. Generate Audio
    audio_path = dest_path.replace(".mp4", ".mp3")
    communicate = edge_tts.Communicate(script, settings.free_service_voice)
    await communicate.save(audio_path)

    # 2. Generate Video using MoviePy
    audio = AudioFileClip(audio_path)
    duration = audio.duration

    # Create a background clip (vertical 1080x1920)
    bg_clip = ColorClip(size=(1080, 1920), color=(30, 30, 30)).with_duration(duration)

    # Create a text clip
    # Note: MoviePy might need ImageMagick for complex TextClips,
    # but let's try a simple one first.
    try:
        text_clip = TextClip(
            text=script,
            font_size=50,
            color='white',
            method='caption',
            size=(900, None)
        ).with_duration(duration).with_position('center')

        video = CompositeVideoClip([bg_clip, text_clip])
    except Exception:
        # Fallback if TextClip fails (e.g. no ImageMagick)
        video = bg_clip

    video = video.with_audio(audio)

    # Use the ffmpeg binary found by imageio_ffmpeg
    video.write_videofile(dest_path, fps=24, codec="libx264", audio_codec="aac")

    # Cleanup audio temp file
    if os.path.exists(audio_path):
        os.remove(audio_path)

    return dest_path
