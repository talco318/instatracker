import express from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const router = express.Router();

// Allowed host patterns (substring match) - broadened to cover common CDNs
const ALLOWED_PATTERNS = ['cdninstagram', 'instagram.com', 'scontent', 'fbcdn', 'akamaihd', 'edgecastcdn', 'cdninstagramcdn'];
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB limit for proxied images

export function isAllowedHost(hostname: string): boolean {
  if (!hostname) return false;
  const hn = hostname.toLowerCase();
  return ALLOWED_PATTERNS.some(p => hn.includes(p));
}

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
  if (!isAllowedHost(hostname)) {
    // respond with 403 but do not return JSON (so image <img> will get a non-image body and fail)
    return res.status(403).send('Host not allowed');
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

    // Protect from extremely large images (if header present)
    const lenHeader = parseInt(upstreamRes.headers['content-length'] || '0', 10);
    if (lenHeader && lenHeader > MAX_BYTES) {
      res.status(413).send('Image too large');
      upstreamRes.destroy();
      return;
    }

    // Forward status and headers so browser gets correct response for <img>
    res.status(statusCode);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=21600');

    let bytes = 0;
    upstreamRes.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        try { res.destroy(); } catch {}
        upstreamRes.destroy();
      }
    });

    // Stream upstream body directly to response (works for 200 and non-200 status codes)
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
