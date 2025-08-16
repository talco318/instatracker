import express from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const router = express.Router();

// Allowed hosts (Instagram CDN patterns)
const ALLOWED_HOSTS = ['cdninstagram.com', 'instagram.com', 'scontent'];
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB limit for proxied images

router.get('/', async (req, res) => {
  const raw = req.query.url as string;
  if (!raw) return res.status(400).json({ error: 'Missing url parameter' });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http/https supported' });
  }

  const hostname = parsed.hostname;
  const allowed = ALLOWED_HOSTS.some(h => hostname.includes(h));
  if (!allowed) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  // Choose client
  const client = parsed.protocol === 'https:' ? https : http;

  const options = {
    method: 'GET',
    headers: {
      // Spoof a common browser user-agent to avoid basic bot blocks
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
      // don't send referer by default
    }
  } as any;

  const request = client.get(parsed.href, options, (upstreamRes: any) => {
    const statusCode = upstreamRes.statusCode || 200;
    const contentType = upstreamRes.headers['content-type'] || 'application/octet-stream';

    // If upstream returned an error status, propagate
    if (statusCode >= 400) {
      res.status(statusCode).json({ error: `Upstream returned ${statusCode}` });
      upstreamRes.destroy();
      return;
    }

    // Protect from extremely large images
    const lenHeader = parseInt(upstreamRes.headers['content-length'] || '0', 10);
    if (lenHeader && lenHeader > MAX_BYTES) {
      res.status(413).json({ error: 'Image too large' });
      upstreamRes.destroy();
      return;
    }

    res.setHeader('Content-Type', contentType);
    // Cache images for 6 hours
    res.setHeader('Cache-Control', 'public, max-age=21600');

    let bytes = 0;
    upstreamRes.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        res.destroy();
        upstreamRes.destroy();
      }
    });

    upstreamRes.pipe(res);
  });

  request.on('error', (err) => {
    console.error('Proxy fetch error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch image' });
  });

  // timeout
  request.setTimeout(10_000, () => {
    request.destroy();
    if (!res.headersSent) res.status(504).json({ error: 'Upstream timeout' });
  });
});

export default router;
