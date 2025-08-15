import cron from 'node-cron';
import { Tracker } from '../models/Tracker';
import { InstagramService } from '../services/InstagramService';
import { EmailService } from '../services/EmailService';

export class CronService {
  private instagramService: InstagramService;
  private emailService: EmailService;

  constructor() {
    this.instagramService = new InstagramService();
    this.emailService = new EmailService();
  }

  start(): void {
    // Check if cron is enabled via environment variable (default: enabled)
    const cronEnabled = process.env.CRON_ENABLED === undefined
      ? true
      : process.env.CRON_ENABLED.toLowerCase() === 'true';
    if (!cronEnabled) {
      console.log('Cron job is disabled (CRON_ENABLED=false)');
      return;
    }
    // Use a faster interval in development (every minute), or configured interval
    const cronInterval = process.env.NODE_ENV === 'development'
      ? process.env.CRON_INTERVAL || '*/1 * * * *'                // every minute for local testing
      : process.env.CRON_INTERVAL || '0 * * * *'; // default: top of every hour in production

    console.log(`Starting cron job with interval: ${cronInterval}`);
    
    cron.schedule(cronInterval, async () => {
      console.log('Running scheduled Instagram check...');
      await this.checkAllTrackers();
    });
  }

  private async checkAllTrackers(): Promise<void> {
    try {
      const activeTrackers = await Tracker.find({ isActive: true });
      console.log(`Checking ${activeTrackers.length} active trackers`);

      for (const tracker of activeTrackers) {
        await this.checkSingleTracker(tracker);
        // Add a small delay between checks to avoid rate limiting
        await this.delay(2000);
      }
    } catch (error) {
      console.error('Error in checkAllTrackers:', error);
    }
  }

  private async checkSingleTracker(tracker: any): Promise<void> {
    try {
      console.log(`Checking tracker for @${tracker.instagramUsername}`);

      // Validate that the account is still public and within limits
      let validation;
      try {
        // Force fresh profile fetch to bypass cache
        validation = await this.instagramService.validateProfile(tracker.instagramUsername, true);
        // Log the fresh count from RapidAPI
        console.log(`Fetched RapidAPI profile for @${tracker.instagramUsername}: followingCount=${validation.profile?.followingCount}`);
        if (!validation.isValid) {
          console.log(`Tracker for @${tracker.instagramUsername} invalid: ${validation.reason}`);
          if (validation.reason === 'Unable to fetch profile') {
            console.warn('Skipping deactivation due to free-tier profile errors');
            // Continue with existing data
          } else {
            // Deactivate if truly invalid (private or over limit)
            tracker.isActive = false;
            await tracker.save();
            return;
          }
        }
      } catch (err) {
        console.warn(`Profile validation error for @${tracker.instagramUsername}, fetching profile directly:`, (err as Error).message);
        // Preserve userId by fetching full profile
        const directProfile = await this.instagramService.getProfile(tracker.instagramUsername, true);
        validation = { isValid: true, profile: directProfile };
        // Log the fresh count after catching validation error
        console.log(`Fetched RapidAPI profile (catch) for @${tracker.instagramUsername}: followingCount=${directProfile.followingCount}`);
      }

      // Attempt to get current following list. If tracker is count-only or fetch fails, fall back to counts.
  let currentFollowingList: string[] = [];
  // Determine if full following list is available (free-tier returns empty list)
  let gotList = false;
      try {
        if (!tracker.countOnly) {
          currentFollowingList = await this.instagramService.getFollowingList(tracker.instagramUsername);
          // Only treat as valid if list has items
          gotList = Array.isArray(currentFollowingList) && currentFollowingList.length > 0;
        }
      } catch (err) {
        console.warn(`Could not fetch following list for @${tracker.instagramUsername}, will try count-only fallback.`,
          (err as Error)?.message || err);
      }

      if (gotList) {
        const newFollowers = currentFollowingList.filter(
          (username: string) => !tracker.followingList.includes(username)
        );

        if (newFollowers.length > 0) {
          console.log(`Found ${newFollowers.length} new followers for @${tracker.instagramUsername}:`, newFollowers);
          try {
            // Attempt to send list notification
            await this.emailService.sendNewFollowerNotification(
              tracker.instagramUsername,
              newFollowers,
              tracker.notificationEmail
            );
          } catch (emailErr) {
            console.error(`Error sending new follower list email for @${tracker.instagramUsername}:`, (emailErr as Error).message);
          }
          // Update tracker regardless of email success
          tracker.followingList = currentFollowingList;
          tracker.currentFollowingCount = currentFollowingList.length;
        } else {
          console.log(`No new followers for @${tracker.instagramUsername}`);
        }
      } else {
        // Count-only fallback: use profile fetched during validation
        // Skip notification if profile is a fallback due to API errors
        if (validation.profile?.isFallback) {
          console.warn(`Skipping count-only notification for @${tracker.instagramUsername} due to fallback profile (API error)`);
        } else {
          const newCount = validation.profile?.followingCount;
          console.log(`Count-only tracker: stored=${tracker.currentFollowingCount}, RapidAPI followingCount=${newCount}`);
          if (typeof newCount === 'number' && newCount !== tracker.currentFollowingCount) {
            console.log(`Following count changed for @${tracker.instagramUsername}: ${tracker.currentFollowingCount} -> ${newCount}`);
            try {
              // Attempt to send count change email
              await this.emailService.sendNewFollowerCountNotification(
                tracker.instagramUsername,
                tracker.currentFollowingCount,
                newCount,
                tracker.notificationEmail
              );
            } catch (emailErr) {
              console.error(`Error sending follower count email for @${tracker.instagramUsername}:`, (emailErr as Error).message);
            }
            // Update count even if email fails to prevent repeat notifications
            tracker.currentFollowingCount = newCount;
          } else {
            console.log(`No change detected for @${tracker.instagramUsername}`);
          }
        }
      }

      // Update last checked timestamp
      tracker.lastChecked = new Date();
      await tracker.save();

    } catch (error) {
      console.error(`Error checking tracker for @${tracker.instagramUsername}:`, error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to manually trigger a check for testing
  async triggerManualCheck(): Promise<void> {
    console.log('Manual check triggered');
    await this.checkAllTrackers();
  }
}