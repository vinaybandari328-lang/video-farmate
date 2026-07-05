import uuid
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.models import VideoRequest, JobRecord
from app.jobs import create_job, get_job
from app.pipeline import run_pipeline

app = FastAPI(
    title="Text to AI Avatar Video API",
    description="Turns a text topic into a talking-avatar video, exported for YouTube and Instagram.",
    version="0.1.0",
)

# Allow the Netlify frontend (or any frontend) to call this API from the browser.
# Lock allow_origins down to your actual Netlify domain before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/generate", response_model=JobRecord)
async def generate_video(req: VideoRequest, background_tasks: BackgroundTasks):
    """
    Kicks off the pipeline as a background task and immediately returns
    a job_id. Poll GET /jobs/{job_id} to check progress and get download
    links once it's done.
    """
    job_id = str(uuid.uuid4())
    record = create_job(job_id)
    background_tasks.add_task(run_pipeline, job_id, req)
    return record


@app.get("/jobs/{job_id}", response_model=JobRecord)
async def get_job_status(job_id: str):
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job_id not found")
    return record


@app.get("/jobs/{job_id}/download/{format_key}")
async def download_output(job_id: str, format_key: str):
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job_id not found")

    path = record.outputs.get(format_key)
    if not path:
        raise HTTPException(status_code=404, detail="that format isn't ready or wasn't requested")

    return FileResponse(path, media_type="video/mp4", filename=f"{format_key}.mp4")


@app.get("/health")
async def health():
    return {"status": "ok"}
