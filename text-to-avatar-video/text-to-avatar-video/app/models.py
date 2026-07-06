from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ExportFormat(str, Enum):
    youtube_landscape = "youtube_landscape"   # 1920x1080, 16:9
    shorts_reels = "shorts_reels"             # 1080x1920, 9:16
    square = "square"                         # 1080x1080, 1:1


class ServiceType(str, Enum):
    heygen = "heygen"
    free = "free"


class JobStatus(str, Enum):
    queued = "queued"
    generating_script = "generating_script"
    rendering_avatar = "rendering_avatar"  # used for both heygen and free generation
    post_processing = "post_processing"
    done = "done"
    failed = "failed"


class VideoRequest(BaseModel):
    topic: str = Field(..., description="What the video should be about")
    target_seconds: int = Field(45, ge=10, le=300, description="Target spoken length")
    service: ServiceType = Field(ServiceType.free, description="Which service to use for video generation")
    avatar_id: Optional[str] = Field(None, description="HeyGen avatar_id, falls back to default")
    voice_id: Optional[str] = Field(None, description="HeyGen voice_id, falls back to default")
    formats: list[ExportFormat] = Field(
        default_factory=lambda: [ExportFormat.shorts_reels],
        description="Which output aspect ratios to render",
    )
    burn_captions: bool = Field(False, description="Requires OPENAI_API_KEY for transcription")


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus
    error: Optional[str] = None
    script: Optional[str] = None
    raw_video_path: Optional[str] = None
    outputs: dict[str, str] = Field(default_factory=dict)  # format -> file path
