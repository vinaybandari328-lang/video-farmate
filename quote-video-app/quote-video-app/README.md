# Quote Reel — Caption Video Studio

Turn a line of text into an animated caption video (color/gradient background,
word-group captions that fade in and out) sized for Instagram Reels/Feed or
YouTube Shorts/standard. Runs entirely server-side with **ffmpeg** — no paid
APIs, no AI video generation service, no external npm packages.

## How it works

1. You type a quote/caption and pick a background, text style, and aspect ratio.
2. The server splits the text into short caption chunks, times them automatically,
   and builds an `ffmpeg` filter graph: a solid/gradient background with
   `drawtext` captions that fade in/out on a timeline.
3. `ffmpeg` renders an `.mp4` (H.264 + silent AAC audio track for platform
   compatibility) and the browser shows a preview + download button.

Output resolutions:
| Option | Resolution | Use for |
|---|---|---|
| 9:16 | 1080×1920 | Instagram Reels, YouTube Shorts, TikTok |
| 1:1 | 1080×1080 | Instagram feed post |
| 16:9 | 1920×1080 | Standard YouTube |

## Run locally

Requires Node 18+ and `ffmpeg` installed on your machine (`ffmpeg -version` to check).

```bash
npm start
# or: node server.js
```

Then open http://localhost:3000

No `npm install` is needed — the app has zero runtime dependencies, only Node's
built-in `http`, `fs`, `path`, `crypto`, and `child_process` modules.

## Deploy to Railway

1. Push this folder to a GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**, pick the repo.
3. Railway will detect `Dockerfile` (also declared in `railway.json`) and build
   from it automatically — this installs `ffmpeg` and fonts in the image, which
   a plain Node buildpack would not do.
4. No environment variables are required. Railway sets `PORT` automatically and
   the server reads `process.env.PORT`.
5. Once deployed, open the generated Railway URL — that's your app.

### Note on storage
Generated videos are written to `outputs/` on local disk and served directly.
Railway's filesystem is ephemeral (wiped on redeploy/restart), and the server
also auto-deletes files older than 1 hour. This is fine for this app's flow —
generate → preview → download immediately — but don't rely on old video links
staying valid long-term. If you need permanent links, add an object storage
step (e.g. upload the finished mp4 to S3/Cloudflare R2/Backblaze) — ask and I
can wire that in.

## Uploading to Instagram / YouTube

This app produces the video file only — actual uploading to Instagram or
YouTube has to happen through their own apps/Studio, since neither offers a
public API for casual/personal posting without going through an app-review
process. Download the mp4 here, then upload it via the Instagram app or
YouTube Studio like any other video.

## Project structure

```
server.js        HTTP server (routing, static files, API, video range-requests)
videoEngine.js    Text chunking, timing, ffmpeg filter construction, rendering
public/           Frontend (index.html, style.css, app.js) — vanilla, no build step
Dockerfile        Node 20 + ffmpeg + fonts
railway.json      Tells Railway to build from the Dockerfile
```

## Extending it

Ideas if you want to grow this later:
- Optional background image/video upload (Ken Burns zoom effect)
- Optional background music upload, mixed into the audio track
- AI voiceover narration (would need a TTS API key)
- Multiple font choices, custom caption timing controls
