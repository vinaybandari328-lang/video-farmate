const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateVideo, cleanupOldOutputs, OUTPUT_DIR } = require('./videoEngine');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });
}

function readJSONBody(req, maxBytes = 200 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Serves a static file, with basic Range support (needed for <video> scrubbing/streaming).
function serveFile(req, res, filePath, headOnly = false) {
  fs.stat(filePath, (err, stat) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      let start = match && match[1] ? parseInt(match[1], 10) : 0;
      let end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
      end = Math.min(end, stat.size - 1);
      if (start > end || start >= stat.size) {
        return send(res, 416, undefined, { 'Content-Range': `bytes */${stat.size}` });
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      if (headOnly) return res.end();
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      if (headOnly) return res.end();
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// Prevent path traversal when resolving requested static paths.
function safeJoin(base, requestPath) {
  const resolved = path.normalize(path.join(base, requestPath));
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === 'POST' && pathname === '/api/generate') {
      let body;
      try {
        body = await readJSONBody(req);
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
      try {
        const result = await generateVideo(body);
        return sendJSON(res, 200, { url: `/outputs/${result.file}`, duration: result.duration });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/outputs/')) {
      const rel = pathname.replace('/outputs/', '');
      const filePath = safeJoin(OUTPUT_DIR, rel);
      if (!filePath) return send(res, 400, 'Bad request');
      return serveFile(req, res, filePath, req.method === 'HEAD');
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const rel = pathname === '/' ? '/index.html' : pathname;
      const filePath = safeJoin(PUBLIC_DIR, rel);
      if (!filePath) return send(res, 400, 'Bad request');
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveFile(req, res, filePath, req.method === 'HEAD');
      }
      return send(res, 404, 'Not found');
    }

    send(res, 405, 'Method not allowed');
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Quote video generator running on port ${PORT}`);
});

// Periodic cleanup of old generated files (Railway disk is ephemeral anyway,
// but this keeps things tidy on long-running instances).
cleanupOldOutputs();
setInterval(() => cleanupOldOutputs(), 15 * 60 * 1000);
