import dotenv from 'dotenv';
dotenv.config();
import { EmailService } from './src/services/EmailService';

(async () => {
  try {
    await new EmailService().sendEmail({
      to: process.env.GMAIL_USER || '',
      subject: 'SMTP Test',
      html: '<p>If you see this, Gmail SMTP is configured correctly.</p>',
    });
    console.log('Test email sent successfully');
  } catch (err) {
    console.error('Test email failed:', err);
  }
})();