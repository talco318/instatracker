# InstaTracker

A full-stack application to monitor public Instagram accounts and receive email notifications when they start following new users.

## Features

- **User Authentication**: Simple email/password signup and login
- **Instagram Monitoring**: Track up to 3 public Instagram accounts per user
- **Email Notifications**: Get notified when tracked accounts follow someone new
- **Real-time Dashboard**: View and manage your trackers
- **Automated Checks**: Background monitoring every 60 minutes

## Tech Stack

### Backend
- **Node.js** with **Express** and **TypeScript**
- **MongoDB** with **Mongoose**
- **JWT** authentication
- **Node-cron** for scheduled tasks
- **Nodemailer** for email notifications
- **RapidAPI Instagram API** for fetching Instagram data

### Frontend
- **React** with **TypeScript**
- **Axios** for API calls
- **CSS3** for styling

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- RapidAPI account with "Instagram - Best Experience" subscription
- Email service (SendGrid, Gmail, or Mailgun)

### 1. Clone and Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../instatracker
npm install
```

### 2. Environment Configuration

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```bash
cp backend/.env.example backend/.env
```

#### Required Environment Variables:

1. **Database**: Set up MongoDB and add the connection string
2. **JWT Secret**: Generate a strong random string
3. **RapidAPI**: 
   - Sign up at [RapidAPI](https://rapidapi.com)
   - Subscribe to "Instagram - Best Experience" API
   - Add your API key
4. **Email Service** (choose one):
   - **SendGrid**: Get API key from [SendGrid](https://sendgrid.com)
   - **Gmail**: Enable 2FA and create an app password
   - **Mailgun**: Get API key from [Mailgun](https://mailgun.com)

### 3. Start the Application

```bash
# Start MongoDB (if running locally)
mongod

# Start Backend (Terminal 1)
cd backend
npm run dev

# Start Frontend (Terminal 2)
cd instatracker
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Add Tracker**: 
   - Enter Instagram username (with or without @)
   - Provide notification email
   - Only public accounts with ≤100 following are accepted
3. **Monitor**: The system automatically checks every 60 minutes
4. **Notifications**: Receive emails when new followers are detected
5. **Manage**: View and remove trackers from the dashboard

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Trackers
- `GET /api/trackers` - Get user's trackers
- `POST /api/trackers` - Add new tracker
- `DELETE /api/trackers/:id` - Remove tracker

### Testing
- `POST /api/test/trigger-check` - Manual check trigger (development only)

## Limitations

- **Public accounts only**: Private Instagram accounts are automatically rejected
- **Following limit**: Accounts with >100 following are rejected
- **Tracker limit**: Maximum 3 trackers per user
- **Rate limiting**: Built-in delays to respect Instagram API limits

## Deployment

### Backend Deployment
1. Set `NODE_ENV=production` in environment
2. Use `CRON_INTERVAL=*/60 * * * *` for production (60 minutes)
3. Ensure MongoDB is accessible
4. Deploy to services like Heroku, AWS, or DigitalOcean

### Frontend Deployment
1. Build the React app: `npm run build`
2. Deploy to services like Netlify, Vercel, or AWS S3
3. Set `REACT_APP_API_URL` to your backend URL

## Development

### Project Structure
```
InstaTracker/
├── backend/
│   ├── src/
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth middleware
│   │   ├── utils/           # Utilities
│   │   └── server.ts        # Main server file
│   ├── .env.example
│   └── package.json
└── instatracker/
    ├── src/
    │   ├── components/      # React components
    │   ├── services/        # API service
    │   └── App.tsx
    └── package.json
```

### Testing
- **Manual Testing**: Use the "Trigger Check" button in development
- **Cron Testing**: Set `CRON_INTERVAL=*/1 * * * *` for 1-minute intervals

## Security Considerations

- JWT tokens for authentication
- Password hashing with bcrypt
- Input validation with Joi
- Rate limiting and error handling
- Environment variable protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please respect Instagram's Terms of Service and API usage policies.

## Support

If you encounter issues:
1. Check your environment variables
2. Verify MongoDB connection
3. Ensure RapidAPI subscription is active
4. Check email service configuration
5. Review server logs for detailed error messages