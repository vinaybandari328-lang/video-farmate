import subprocess
from app.models import ExportFormat

# width, height for each target platform
FORMAT_DIMENSIONS = {
    ExportFormat.youtube_landscape: (1920, 1080),
    ExportFormat.shorts_reels: (1080, 1920),
    ExportFormat.square: (1080, 1080),
}


def export_format(source_path: str, dest_path: str, fmt: ExportFormat) -> str:
    """
    Uses ffmpeg to scale + center-crop the source video to the target
    aspect ratio. Requires ffmpeg to be installed and on PATH.
    """
    width, height = FORMAT_DIMENSIONS[fmt]

    # scale up to cover the target box, then crop the overflow from the center
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height}"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        dest_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg export failed for {fmt}: {result.stderr[-2000:]}")

    return dest_path


def burn_captions(source_path: str, srt_path: str, dest_path: str) -> str:
    """
    Burns an .srt subtitle file into the video as hardcoded captions.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-vf", f"subtitles={srt_path}:force_style='FontSize=16,Outline=2'",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "copy",
        dest_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg caption burn failed: {result.stderr[-2000:]}")

    return dest_path
