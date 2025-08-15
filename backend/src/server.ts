// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

// Suppress util._extend deprecation warnings (DEP0060)
process.on('warning', (warning: any) => {
  if (warning.name === 'DeprecationWarning' && warning.code === 'DEP0060') {
    return;
  }
  console.warn(warning.name, warning.message);
});

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('RAPIDAPI_KEY:', process.env.RAPIDAPI_KEY ? `${process.env.RAPIDAPI_KEY.substring(0, 10)}...` : 'NOT LOADED');
console.log('RAPIDAPI_HOST:', process.env.RAPIDAPI_HOST);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'LOADED' : 'NOT LOADED');

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import trackerRoutes from './routes/trackers';
import babyRoutes from './routes/baby';
import { CronService } from './services/CronService';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trackers', trackerRoutes);
app.use('/api/baby', babyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'InstaTracker API is running' });
});

// Test endpoint for manual cron trigger (development only)
let cronService: CronService;
app.post('/api/test/trigger-check', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    await cronService.triggerManualCheck();
    res.json({ message: 'Manual check triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger manual check' });
  }
});

// Test Instagram API endpoint (development only)
app.get('/api/test/instagram/:username', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    const { InstagramService } = await import('./services/InstagramService');
    const instagramService = new InstagramService();
    
    const username = req.params.username;
    console.log(`Testing Instagram API for username: ${username}`);
    
    // Test profile fetch
    const validation = await instagramService.validateProfile(username);
    
    let followingList: string[] = [];
    if (validation.isValid) {
      // Test following list fetch
      followingList = await instagramService.getFollowingList(username);
    }
    
    res.json({
      username,
      validation,
      followingCount: followingList.length,
      followingPreview: followingList.slice(0, 5), // Show first 5 for testing
      message: 'Instagram API test completed'
    });
  } catch (error: any) {
    console.error('Instagram API test error:', error);
    res.status(500).json({ 
      error: 'Instagram API test failed',
      details: error.message
    });
  }
});

// Database connection
const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/instatracker';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDB();
    
    // Start cron service
    cronService = new CronService();
    cronService.start();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the application
startServer().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});