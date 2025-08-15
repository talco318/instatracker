import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): nodemailer.Transporter {
    // Check which email service is configured
    if (process.env.SENDGRID_API_KEY) {
      // SendGrid configuration
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      // Explicit Gmail SMTP configuration
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // use TLS
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS
        },
        logger: true,
        debug: true
      });
    } else if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      // Mailgun SMTP configuration
      return nodemailer.createTransport({
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
          pass: process.env.MAILGUN_API_KEY
        }
      });
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev fallback: log emails to console as JSON
      console.warn('No email service configured: using JSON transport for development');
      return nodemailer.createTransport({ jsonTransport: true });
    } else {
      // In production, require valid config
      throw new Error('No email service configured. Please set up SendGrid, Gmail, or Mailgun in your .env file');
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@instatracker.com',
        to: options.to,
        subject: options.subject,
        html: options.html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendNewFollowerNotification(
    instagramUsername: string,
    newFollowers: string[],
    notificationEmail: string
  ): Promise<void> {
    const subject = `New Followers Alert for @${instagramUsername}`;
    
    const followersList = newFollowers.map(username => `<li>@${username}</li>`).join('');
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Instagram Follower Update</h2>
        <p>Hello!</p>
        <p>We detected that <strong>@${instagramUsername}</strong> has started following new accounts:</p>
        <ul style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          ${followersList}
        </ul>
        <p>This notification was sent from your InstaTracker dashboard.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">
          If you wish to stop receiving these notifications, please log into your InstaTracker dashboard and remove this tracker.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: notificationEmail,
      subject,
      html
    });
  }

  async sendNewFollowerCountNotification(
    instagramUsername: string,
    oldCount: number,
    newCount: number,
    notificationEmail: string
  ): Promise<void> {
    const subject = `Follower Count Change for @${instagramUsername}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Instagram Follower Count Change</h2>
        <p>Hello!</p>
        <p>We detected a change in the following count for <strong>@${instagramUsername}</strong>:</p>
        <p>Previous following count: <strong>${oldCount}</strong></p>
        <p>Current following count: <strong>${newCount}</strong></p>
        <p>We couldn't retrieve the exact usernames (this tracker is operating in count-only mode).</p>
        <hr>
        <p style="color: #888; font-size: 12px;">
          If you wish to stop receiving these notifications, please log into your InstaTracker dashboard and remove this tracker.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: notificationEmail,
      subject,
      html
    });
  }
}