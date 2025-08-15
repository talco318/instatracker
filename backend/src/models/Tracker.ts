import mongoose, { Document, Schema } from 'mongoose';

export interface ITracker extends Document {
  userId: mongoose.Types.ObjectId;
  instagramUsername: string;
  notificationEmail: string;
  currentFollowingCount: number;
  followingList: string[]; // Array of Instagram usernames
  countOnly?: boolean;
  isActive: boolean;
  createdAt: Date;
  lastChecked: Date;
}

const trackerSchema = new Schema<ITracker>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  instagramUsername: {
    type: String,
    required: true,
    trim: true
  },
  notificationEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  currentFollowingCount: {
    type: Number,
    required: true,
    default: 0
  },
  followingList: [{
    type: String,
    trim: true
  }],
  // If true, we only store counts (no follower/following usernames available)
  countOnly: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastChecked: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one tracker per user per Instagram account
trackerSchema.index({ userId: 1, instagramUsername: 1 }, { unique: true });

export const Tracker = mongoose.model<ITracker>('Tracker', trackerSchema);