from app.models import JobRecord, JobStatus

# NOTE: this is an in-memory dict for demo purposes only.
# It will reset on restart and won't work across multiple worker processes.
# Swap this for Redis or a database table before deploying for real.
_JOBS: dict[str, JobRecord] = {}


def create_job(job_id: str) -> JobRecord:
    record = JobRecord(job_id=job_id, status=JobStatus.queued)
    _JOBS[job_id] = record
    return record


def get_job(job_id: str) -> JobRecord | None:
    return _JOBS.get(job_id)


def update_job(job_id: str, **fields) -> JobRecord:
    record = _JOBS[job_id]
    updated = record.model_copy(update=fields)
    _JOBS[job_id] = updated
    return updated
