const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const OUTPUT_DIR = path.join(__dirname, 'outputs');
const TMP_DIR = path.join(__dirname, 'tmp');

const RESOLUTIONS = {
  '9:16': [1080, 1920], // Instagram Reels / YouTube Shorts / TikTok
  '1:1': [1080, 1080],  // Instagram feed post
  '16:9': [1920, 1080], // YouTube standard
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function normalizeColor(hex, fallback) {
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) return fallback;
  return hex.startsWith('#') ? hex : '#' + hex;
}

function chunkText(rawText, maxWords = 6) {
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  if (chunks.length > 1 && chunks[chunks.length - 1].split(' ').length < 2) {
    const last = chunks.pop();
    chunks[chunks.length - 1] += ' ' + last;
  }
  return chunks;
}

function computeTimings(chunks) {
  const perWord = 0.42;
  const minDur = 1.1;
  const maxDur = 4.2;
  let t = 0;
  const timings = [];
  for (const c of chunks) {
    const wc = c.split(' ').length;
    const dur = Math.min(maxDur, Math.max(minDur, wc * perWord));
    timings.push({ text: c, start: t, end: t + dur });
    t += dur;
  }
  return { timings, total: t };
}

// Validate options and fill defaults. Throws a descriptive Error on bad input.
function validateOptions(opts) {
  const text = (opts.text || '').toString().trim();
  if (!text) throw new Error('Text is required.');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 220) throw new Error('Text is too long (max ~220 words) — keep it short for social video.');

  const aspect = RESOLUTIONS[opts.aspect] ? opts.aspect : '9:16';
  const bgType = opts.bgType === 'solid' ? 'solid' : 'gradient';
  const color1 = normalizeColor(opts.color1, '#6C5CE7');
  const color2 = normalizeColor(opts.color2, '#FD79A8');
  const fontColorRaw = (opts.fontColor || 'white').toString();
  const fontColor = /^[a-zA-Z]+$/.test(fontColorRaw) || HEX_RE.test(fontColorRaw)
    ? (HEX_RE.test(fontColorRaw) ? fontColorRaw.replace('#', '0x') : fontColorRaw)
    : 'white';
  const textBackground = opts.textBackground !== false;
  const fontSizeKey = ['small', 'medium', 'large'].includes(opts.fontSize) ? opts.fontSize : 'medium';

  return { text, aspect, bgType, color1, color2, fontColor, textBackground, fontSizeKey };
}

function buildFilter({ text, aspect, bgType, color1, color2, fontColor, textBackground, fontSizeKey }, tmpDir) {
  const [W, H] = RESOLUTIONS[aspect];
  const chunks = chunkText(text);
  const { timings, total } = computeTimings(chunks);
  const duration = Math.max(1.5, total);
  const fontSizeMap = { small: W / 20, medium: W / 16, large: W / 12 };
  const fontSize = Math.round(fontSizeMap[fontSizeKey]);
  const fadeSec = 0.25;

  let filter;
  if (bgType === 'solid') {
    filter = `color=c=${color1.replace('#', '0x')}:s=${W}x${H}:d=${duration}:r=30[bg]`;
  } else {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const rExpr = `(${c1.r})+((${c2.r}-${c1.r}))*(Y/H)`;
    const gExpr = `(${c1.g})+((${c2.g}-${c1.g}))*(Y/H)`;
    const bExpr = `(${c1.b})+((${c2.b}-${c1.b}))*(Y/H)`;
    filter = `color=c=black:s=${W}x${H}:d=${duration}:r=30[base];[base]geq=r='${rExpr}':g='${gExpr}':b='${bExpr}'[bg]`;
  }

  let prev = 'bg';
  timings.forEach((t, i) => {
    const label = `t${i}`;
    const textFilePath = path.join(tmpDir, `chunk_${i}.txt`);
    fs.writeFileSync(textFilePath, t.text, 'utf8');
    const alphaExpr = `if(lt(t,${t.start}+${fadeSec}),(t-${t.start})/${fadeSec},if(gt(t,${t.end}-${fadeSec}),(${t.end}-t)/${fadeSec},1))`;
    const enableExpr = `between(t,${t.start},${t.end})`;
    filter += `;[${prev}]drawtext=fontfile=${FONT_PATH}:textfile='${textFilePath}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=10${textBackground ? ':box=1:boxcolor=black@0.45:boxborderw=28' : ''}:enable='${enableExpr}':alpha='${alphaExpr}'[${label}]`;
    prev = label;
  });

  return { filter, finalLabel: prev, duration, W, H };
}

async function generateVideo(rawOpts) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const opts = validateOptions(rawOpts);
  const jobId = crypto.randomUUID();
  const tmpDir = path.join(TMP_DIR, jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const { filter, finalLabel, duration } = buildFilter(opts, tmpDir);
  const outFile = `${jobId}.mp4`;
  const outPath = path.join(OUTPUT_DIR, outFile);

  const args = [
    '-y',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', filter,
    '-map', `[${finalLabel}]`,
    '-map', '0:a',
    '-t', String(duration),
    '-r', '30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outPath,
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (code === 0) resolve();
      else reject(new Error('Video render failed: ' + stderr.slice(-1500)));
    });
  });

  return { file: outFile, duration };
}

// Delete generated videos older than maxAgeMs (default 1 hour) — Railway disks are ephemeral,
// and we don't want to keep serving/storing files forever anyway.
function cleanupOldOutputs(maxAgeMs = 60 * 60 * 1000) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const now = Date.now();
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    const p = path.join(OUTPUT_DIR, f);
    try {
      const stat = fs.statSync(p);
      if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(p);
    } catch (_) {}
  }
}

module.exports = { generateVideo, cleanupOldOutputs, OUTPUT_DIR, RESOLUTIONS };
