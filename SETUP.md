# InstaTracker - Setup and Configuration Guide

## 🎯 Quick Setup Checklist

### 1. **Environment Setup** (CRITICAL)
Edit `backend/.env` with your actual values:

```bash
# 🔐 Generate a secure JWT secret (use a random string generator)
JWT_SECRET=your_super_secure_jwt_secret_key_here

# 📧 RapidAPI for Instagram data
RAPIDAPI_KEY=your_rapidapi_key_from_rapidapi_com
RAPIDAPI_HOST=instagram-scraper-2022.p.rapidapi.com

# 💌 Email Service (choose ONE)
# Option A: SendGrid (recommended)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@yourdomain.com

# Option B: Gmail
# GMAIL_USER=your_email@gmail.com
# GMAIL_PASS=your_gmail_app_password

# 🗄️ Database (local MongoDB)
MONGODB_URI=mongodb://localhost:27017/instatracker

# ⏰ Cron schedule
CRON_INTERVAL=*/60 * * * *  # Every 60 minutes
```

### 2. **Required Services**

#### RapidAPI Setup:
1. Go to [RapidAPI.com](https://rapidapi.com)
2. Search for "Instagram - Best Experience"
3. Subscribe to the free tier
4. Copy your API key to the .env file

#### Email Service Setup (choose one):

**Option A: SendGrid (Recommended)**
1. Sign up at [SendGrid.com](https://sendgrid.com)
2. Create an API key
3. Verify your sender email

**Option B: Gmail**
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use your Gmail and app password

### 3. **Database Setup**
Install and start MongoDB:
```bash
# Windows (with Chocolatey)
choco install mongodb

# macOS (with Homebrew)
brew install mongodb/brew/mongodb-community

# Start MongoDB
mongod
```

### 4. **Installation & Start**
```bash
# Install all dependencies
npm run install:all

# Start both backend and frontend
npm run dev
```

## 🚀 Running the Application

### Development Mode:
```bash
# Option 1: Start both services together
npm run dev

# Option 2: Start separately
# Terminal 1:
cd backend && npm run dev

# Terminal 2: 
cd instatracker && npm start
```

### Production Mode:
```bash
# Build everything
npm run build

# Start backend
cd backend && npm start
```

## 🔧 Testing & Verification

### 1. Health Check
- Backend: http://localhost:5000/api/health
- Frontend: http://localhost:3000

### 2. Manual Testing
1. Register a new account
2. Add an Instagram tracker
3. Use "Trigger Check (Test)" button
4. Verify email notifications

### 3. API Testing
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 📋 Application Features

### User Authentication
- ✅ Email/password registration
- ✅ JWT-based authentication
- ✅ Secure password hashing

### Instagram Tracking
- ✅ Public accounts only
- ✅ Max 100 following limit
- ✅ Max 3 trackers per user
- ✅ Real-time following detection

### Email Notifications
- ✅ New follower alerts
- ✅ HTML formatted emails
- ✅ Multiple email service support

### Dashboard
- ✅ Tracker management
- ✅ Real-time status
- ✅ Manual check trigger (dev)

## 🛠️ Troubleshooting

### Common Issues:

**Backend won't start:**
- Check MongoDB is running
- Verify .env file exists and has correct values
- Check port 5000 is available

**Frontend won't connect:**
- Ensure backend is running on port 5000
- Check proxy setting in frontend package.json

**Email not sending:**
- Verify email service credentials
- Check spam folder
- Test email service connection

**Instagram API errors:**
- Verify RapidAPI key is valid
- Check API subscription status
- Ensure account is public and under 100 following

### Debug Commands:
```bash
# Check backend logs
cd backend && npm run dev

# Test email service
curl -X POST http://localhost:5000/api/test/trigger-check

# MongoDB connection test
mongosh mongodb://localhost:27017/instatracker
```

## 📊 Project Structure
```
InstaTracker/
├── 📁 backend/              # Node.js API server
│   ├── src/
│   │   ├── models/          # Database schemas
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── server.ts        # Main server
│   └── .env                 # Environment config
├── 📁 instatracker/         # React frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   └── services/        # API client
└── 📄 README.md             # This file
```

## 🚦 Next Steps

1. **Configure your environment** (most important!)
2. **Test the application** with a public Instagram account
3. **Set up production deployment** when ready
4. **Monitor email delivery** and API usage

## 📞 Need Help?

Check the logs for detailed error messages:
- Backend logs: Terminal running `npm run dev:backend`
- Frontend logs: Browser Developer Console
- MongoDB logs: MongoDB terminal output

The application includes comprehensive error handling and logging to help diagnose issues.