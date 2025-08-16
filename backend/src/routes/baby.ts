import express from 'express';
import { NoBabyNoCryService } from '../services/NoBabyNoCryService';

const router = express.Router();
const service = new NoBabyNoCryService();

// GET /api/baby/:username
router.get('/:username', async (req, res) => {
  try {
    const urls = await service.detect(req.params.username);
    res.json({ urls });
  } catch (error: any) {
    console.error('NoBabyNoCry error:', error);
    // Handle RapidAPI quota errors
    if (error.message && error.message.toLowerCase().includes('quota')) {
      return res.status(429).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Detection failed' });
  }
});

// POST /api/baby/manual - accept an array of image URLs (up to 12) to analyze
router.post('/manual', async (req, res) => {
  try {
    const urls = Array.isArray(req.body.urls) ? req.body.urls.slice(0, 12) : [];
    if (urls.length === 0) return res.status(400).json({ error: 'No urls provided' });

    const results = [] as any[];
    for (const url of urls) {
      try {
        const detection = await service.analyzeImageSchema(url);
        results.push({ url, ...detection });
      } catch (e: any) {
        console.error('Manual detection error for', url, e?.message || e);
      }
    }

    res.json({ urls: results });
  } catch (error: any) {
    console.error('NoBabyNoCry manual error:', error);
    res.status(500).json({ error: error.message || 'Manual detection failed' });
  }
});

export default router;
