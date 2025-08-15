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

export default router;