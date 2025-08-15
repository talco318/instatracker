import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Tracker } from '../models/Tracker';
import { InstagramService } from '../services/InstagramService';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { trackerSchema } from '../utils/validation';

const router = Router();
const instagramService = new InstagramService();

// Get all trackers for authenticated user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const trackers = await Tracker.find({ userId: req.user._id, isActive: true })
      .select('instagramUsername currentFollowingCount notificationEmail createdAt lastChecked countOnly')
      .sort({ createdAt: -1 });

    // Fetch fresh counts if using free-tier
    const normalized = await Promise.all(trackers.map(async (t: any) => {
      let count = t.currentFollowingCount;
      try {
        const profile = await instagramService.getProfile(t.instagramUsername);
        // Only update if the fetched count is positive (avoid zero fallbacks)
        if (typeof profile.followingCount === 'number' && profile.followingCount > 0) {
          count = profile.followingCount;
        }
      } catch (err) {
        console.warn(`Failed to refresh count for @${t.instagramUsername}:`, (err as Error).message);
      }
      return {
        id: t._id.toString(),
        instagramUsername: t.instagramUsername,
        currentFollowingCount: count,
        notificationEmail: t.notificationEmail,
        createdAt: t.createdAt,
        lastChecked: t.lastChecked,
        countOnly: t.countOnly || false
      };
    }));

    res.json({ trackers: normalized });
  } catch (error) {
    console.error('Error fetching trackers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new tracker
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = trackerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { instagramUsername, notificationEmail } = value;
    const cleanUsername = instagramUsername.replace('@', '');

    // Check if user already has 3 trackers
    const userTrackerCount = await Tracker.countDocuments({ 
      userId: req.user._id, 
      isActive: true 
    });
    
    if (userTrackerCount >= 3) {
      return res.status(400).json({ error: 'Maximum of 3 trackers allowed per user' });
    }

    // Check if this Instagram account is already being tracked by this user
    const existingTracker = await Tracker.findOne({
      userId: req.user._id,
      instagramUsername: cleanUsername,
      isActive: true
    });

    if (existingTracker) {
      return res.status(409).json({ error: 'Instagram account is already being tracked' });
    }

    // Validate Instagram profile
    const validation = await instagramService.validateProfile(cleanUsername);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.reason });
    }

    // Free-tier tracking: only profile data available, operate in count-only mode
    const followingList: string[] = [];
    const countOnly = true;

    // Create tracker
    const tracker = new Tracker({
      userId: req.user._id,
      instagramUsername: cleanUsername,
      notificationEmail,
      currentFollowingCount: validation.profile?.followingCount || followingList.length || 0,
      followingList,
      countOnly
    });

    try {
      await tracker.save();
    } catch (err: any) {
      // Handle duplicate key race (unique index on userId + instagramUsername)
      if (err && err.code === 11000) {
        return res.status(409).json({ error: 'Instagram account is already being tracked' });
      }
      throw err;
    }

    res.status(201).json({
      message: 'Tracker created successfully',
      tracker: {
        id: tracker._id,
        instagramUsername: tracker.instagramUsername,
        currentFollowingCount: tracker.currentFollowingCount,
        notificationEmail: tracker.notificationEmail,
        createdAt: tracker.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating tracker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove tracker
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate id presence and format
    if (!id) {
      return res.status(400).json({ error: 'Tracker id is required' });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tracker id' });
    }

    const tracker = await Tracker.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true
    });

    if (!tracker) {
      return res.status(404).json({ error: 'Tracker not found' });
    }

    tracker.isActive = false;
    await tracker.save();

    res.json({ message: 'Tracker removed successfully' });
  } catch (error) {
    console.error('Error removing tracker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch raw followers list by user ID via RapidAPI free-tier
router.get('/followers/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const nextId = (req.query.next_max_id || req.query.max_id) as string | undefined;
    const data = await instagramService.getFollowersByUserId(userId, nextId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching followers for userId', req.params.userId, error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

export default router;