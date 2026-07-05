# Text to AI Avatar Video

A FastAPI starter project that turns a text topic into a talking-avatar video,
exported in the aspect ratios YouTube and Instagram want.

Pipeline: topic -> script (Claude) -> avatar video (HeyGen) -> optional
auto-captions (Whisper) -> per-platform export (ffmpeg).

## Deploy this backend (needed before the Netlify frontend will work)

Netlify only hosts static frontends. This backend needs a host that runs a
real, persistent Python process with ffmpeg installed. Pick one:

### Option A: Railway

This repo includes `railway.json` and a `Dockerfile`, so Railway builds it
with ffmpeg baked in automatically.

1. Push this folder to a GitHub repo.
2. Go to https://railway.app/new -> **Deploy from GitHub repo** -> pick this repo.
   Railway detects `railway.json` and builds from the `Dockerfile` automatically.
3. Once the service is created, open its **Variables** tab and add:
   `ANTHROPIC_API_KEY`, `HEYGEN_API_KEY`, `HEYGEN_DEFAULT_AVATAR_ID`,
   `HEYGEN_DEFAULT_VOICE_ID` (and `OPENAI_API_KEY` if you want captions).
4. Open the **Settings** tab -> **Networking** -> **Generate Domain**. Railway
   doesn't expose a public URL by default, you have to click this once.
5. Copy that domain (something like `https://text-to-avatar-video-api.up.railway.app`).
6. Test it's alive: open `https://<your-railway-domain>/health` in a browser —
   you should see `{"status":"ok"}`.
7. Paste that exact URL into the "backend url" field on your Netlify site.

Railway redeploys automatically on every push to your connected branch.

### Option B: Render

This repo also includes `render.yaml` for Render's Blueprint deploys.

1. Push this folder to a GitHub repo.
2. Go to https://dashboard.render.com/blueprints -> **New Blueprint Instance**
   -> connect your repo. Render reads `render.yaml` and `Dockerfile`
   automatically. (No blueprint option? Create a **New Web Service**
   manually, choose "Docker" as the runtime, point it at this repo.)
3. Fill in the same environment variables as above when prompted.
4. Deploy. Render gives you a URL like `https://text-to-avatar-video-api.onrender.com`.
5. Test `https://<your-render-url>/health` returns `{"status":"ok"}`.
6. Paste that URL into the "backend url" field on your Netlify site.

Both Railway's and Render's free tiers spin services down when idle and take
~30-60s to wake up on the first request after a while — that's normal.

## Run it locally instead (optional, for testing before you deploy)

### 1. Install

```bash
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```

You also need **ffmpeg** installed and on your PATH:
- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: download from ffmpeg.org and add it to PATH

## 2. Configure

```bash
cp .env.example .env
```

Then fill in `.env`:
- `ANTHROPIC_API_KEY` — for script generation
- `HEYGEN_API_KEY` — for avatar video rendering (sign up at heygen.com, Labs/API plan)
- `HEYGEN_DEFAULT_AVATAR_ID` / `HEYGEN_DEFAULT_VOICE_ID` — get these from
  `GET https://api.heygen.com/v2/avatars` and `GET https://api.heygen.com/v2/voices`
  with your API key, or from the HeyGen dashboard
- `OPENAI_API_KEY` — only needed if you set `burn_captions: true` in a request

## 3. Run

```bash
uvicorn app.main:app --reload
```

The API docs are at `http://localhost:8000/docs` (Swagger UI) once it's running.

## 4. Generate a video

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
        "topic": "3 tips for staying focused while working from home",
        "target_seconds": 30,
        "formats": ["shorts_reels", "youtube_landscape"],
        "burn_captions": true
      }'
```

This returns a `job_id` immediately. The render itself happens in the
background and typically takes 1-3 minutes depending on script length.

Poll status:

```bash
curl http://localhost:8000/jobs/<job_id>
```

Once `"status": "done"`, download a finished file:

```bash
curl -OJ http://localhost:8000/jobs/<job_id>/download/shorts_reels
```

## Project layout

```
app/
  main.py              FastAPI routes: /generate, /jobs/{id}, /jobs/{id}/download/{format}
  pipeline.py           Orchestrates the full pipeline for one job
  jobs.py               In-memory job store (swap for Redis/DB in production)
  models.py             Pydantic request/response schemas
  config.py             Environment-based settings
  services/
    script_gen.py       Calls Claude to write the narration script
    heygen.py            Calls HeyGen to render the avatar + voice video
    video_export.py     ffmpeg: crops/scales master render into each platform format
    captions.py           Optional: Whisper transcription -> burned-in captions
```

## Notes before you take this to production

- **Job store**: `app/jobs.py` is an in-memory dict for demo purposes. It resets
  on restart and won't work if you run more than one server process. Swap it
  for Redis or a database table, and swap `BackgroundTasks` for a real queue
  (Celery, RQ, or similar) once render volume grows.
- **Cost**: HeyGen (and any avatar API) bills per rendered minute. Track usage
  per user/job before you expose this publicly.
- **Rights/consent**: if users can upload their own photo or voice to create a
  custom avatar, add an explicit consent step — don't skip this.
- **Master render resolution**: this starter renders a 1080x1920 vertical
  master from HeyGen and crops it for other formats. If your avatar's framing
  doesn't crop well to 16:9, consider rendering a landscape master instead and
  cropping down to vertical, or rendering twice.
