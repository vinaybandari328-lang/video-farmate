import os
from app.config import settings
from app.models import VideoRequest, JobStatus, ServiceType
from app.jobs import update_job
from app.services import script_gen, heygen, video_export, captions, free_video


async def run_pipeline(job_id: str, req: VideoRequest) -> None:
    """
    Runs the full text -> avatar video -> multi-format export pipeline
    for one job, updating the shared job record as it progresses.
    Any exception is caught and stored on the job as a failure so the
    API layer can report it instead of crashing the background task.
    """
    job_dir = os.path.join(settings.output_dir, job_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        # 1. Script generation
        update_job(job_id, status=JobStatus.generating_script)
        script = await script_gen.generate_script(req.topic, req.target_seconds)
        update_job(job_id, script=script)

        # 2. Avatar + voice video generation
        update_job(job_id, status=JobStatus.rendering_avatar)
        raw_path = os.path.join(job_dir, "raw_master.mp4")

        if req.service == ServiceType.heygen:
            avatar_id = req.avatar_id or settings.heygen_default_avatar_id
            voice_id = req.voice_id or settings.heygen_default_voice_id

            video_id = await heygen.create_avatar_video(script, avatar_id, voice_id)
            video_url = await heygen.wait_for_video(video_id)
            await heygen.download_video(video_url, raw_path)
        else:
            await free_video.generate_free_video(script, raw_path)

        update_job(job_id, raw_video_path=raw_path)

        # 3. Optional captions, burned into the master before per-format export
        update_job(job_id, status=JobStatus.post_processing)
        source_for_export = raw_path

        if req.burn_captions:
            srt_path = os.path.join(job_dir, "captions.srt")
            await captions.generate_srt(raw_path, srt_path)

            captioned_path = os.path.join(job_dir, "master_captioned.mp4")
            video_export.burn_captions(raw_path, srt_path, captioned_path)
            source_for_export = captioned_path

        # 4. Export one file per requested platform aspect ratio
        outputs: dict[str, str] = {}
        for fmt in req.formats:
            dest_path = os.path.join(job_dir, f"{fmt.value}.mp4")
            video_export.export_format(source_for_export, dest_path, fmt)
            outputs[fmt.value] = dest_path

        update_job(job_id, status=JobStatus.done, outputs=outputs)

    except Exception as exc:  # noqa: BLE001
        update_job(job_id, status=JobStatus.failed, error=str(exc))
