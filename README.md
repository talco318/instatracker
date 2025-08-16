# InstaTracker

InstaTracker monitors public Instagram accounts and notifies you by email when those accounts start following someone new. It also includes a second service, "No Baby No Cry", which inspects recent posts and detects baby/toddler images using the OpenAI Responses API.

This README documents the project structure, how to run it locally, important runtime configuration, deployed URLs (example), REST endpoints, and operational notes.

---

## Live / Deployments (example)

- Backend (Render): https://instatracker-uc3f.onrender.com  
  - API base: https://instatracker-uc3f.onrender.com/api

- Frontend (Render): Deployed separately (set `REACT_APP_API_URL` to the backend API base above during frontend build).

If you deploy frontend and backend as separate services (e.g., both on Render), make sure the frontend build has the env var `REACT_APP_API_URL=https://instatracker-uc3f.onrender.com/api` (or your backend URL) so the client makes requests to the correct host.

---

## Project overview

- Backend: Node.js + Express + TypeScript (folder: `backend/`)
- Frontend: React + TypeScript (Create React App) (folder: `instatracker/`)
- Database: MongoDB (Mongoose)
- Instagram data: RapidAPI provider: "Instagram – Best Experience"
- Image analysis: OpenAI Responses API (JSON schema output)
- Email: configurable (Gmail SMTP, SendGrid, Mailgun; JSON transport fallback in dev)
- Image proxy: `/api/proxy?url=...` — server-side proxy to fetch Instagram CDN images (helps hotlink/CORS issues)

---

## Key API endpoints (backend)

- GET /api/health — health check
- POST /api/auth/register — register { email, password }
- POST /api/auth/login — login { email, password }
- GET /api/trackers — list trackers (requires Authorization: Bearer <token>)
- POST /api/trackers — add tracker { instagramUsername, notificationEmail }
- DELETE /api/trackers/:id — remove tracker
- POST /api/test/trigger-check — manual trigger for the cron check (development only)
- GET /api/baby/:username — No Baby No Cry check for latest posts of a username
- GET /api/proxy?url=<encoded-url> — image proxy endpoint (use to avoid CDN hotlink/CORS problems)

Notes:
- The frontend expects backend API base to be available at `REACT_APP_API_URL` at build time (or falls back to `/api` for same-origin setups).

---

## Requirements coverage / Features

- Auth: Email + password registration and JWT login (no OAuth). See `backend/src/routes/auth.ts` and `backend/src/utils/auth.ts`.
- InstaTracker: Add trackers (max 3 per user), validate account is public and <=100 following, store baseline following list, cron-based polling to detect new follows and email notifications. Implemented in `backend/src/routes/trackers.ts`, `backend/src/services/InstagramService.ts`, `backend/src/services/CronService.ts` and `backend/src/services/EmailService.ts`.
- No Baby No Cry: Backend calls RapidAPI to fetch recent media and uses OpenAI Responses API to detect baby images (JSON schema). See `backend/src/services/NoBabyNoCryService.ts` and route `backend/src/routes/baby.ts`.
- Image proxy: `backend/src/routes/proxy.ts` — fetches remote images and streams them to the client (with host whitelist and size guard).

Important caveats:
- The RapidAPI free tier may not allow listing user media or may rate-limit certain endpoints. `NoBabyNoCry` will fail gracefully if media listing is unavailable; you may need to upgrade your RapidAPI subscription to enable post listing for some accounts.
- Some Instagram CDN hosts may be added to the proxy whitelist as needed; if a thumbnail still fails, capture the CDN hostname and add it to `ALLOWED_PATTERNS` in `backend/src/routes/proxy.ts`.

---

## Environment variables

Create `backend/.env` (do not commit). Important keys:

Required:
- JWT_SECRET=your_jwt_secret
- RAPIDAPI_KEY=your_rapidapi_key
- RAPIDAPI_HOST=instagram-best-experience.p.rapidapi.com
- MONGODB_URI=mongodb://.../instatracker
- OPENAI_API_KEY=sk-...

Email options (choose one):
- SENDGRID_API_KEY and EMAIL_FROM
- or GMAIL_USER and GMAIL_PASS (use App Password)

Cron / runtime:
- CRON_ENABLED=true (set false to disable scheduled jobs locally)
- CRON_INTERVAL=*/60 * * * * (default hourly in production; the project has a CRON_ENABLED toggle)

Frontend build-time:
- REACT_APP_API_URL (e.g. https://instatracker-uc3f.onrender.com/api) — must be set during the frontend build on Render

Security note: If you accidentally committed secrets, rotate them immediately (RapidAPI keys, OpenAI keys, email keys). Remove `.env` from the repo and add to `.gitignore`.

---

## Running locally

Prereqs: Node.js, npm, MongoDB

1. Backend

```bash
cd backend
cp .env.example .env   # edit with real values
npm install
npm run build
npm start
```

2. Frontend (development)

```bash
cd instatracker
npm install
# set REACT_APP_API_URL in your shell if your backend is external
export REACT_APP_API_URL=http://localhost:5000/api
npm start
```

3. Frontend (production build)

```bash
cd instatracker
REACT_APP_API_URL=http://localhost:5000/api npm run build
```

---

## Deploying on Render (short checklist)

Backend service (Node/TypeScript)
1. Connect the `backend/` repo to Render
2. Add environment variables (JWT_SECRET, RAPIDAPI_KEY, RAPIDAPI_HOST, MONGODB_URI, OPENAI_API_KEY, email creds, CRON_ENABLED)
3. Build command: npm install --save-dev @types/node; npm run build
4. Start command: npm run start

Frontend service (Static site)
1. Connect the `instatracker/` repo to Render
2. Add environment variable: `REACT_APP_API_URL`=https://<your-backend-host>/api
3. Build command: npm run build
4. Publish the `build/` directory

Important: CRA reads `REACT_APP_*` variables at build-time. On Render, add the env var before starting the build.

---

## Troubleshooting

- Frontend can't reach backend:
  - Verify frontend was built with `REACT_APP_API_URL` set to your backend base URL (including `/api`).
  - In browser DevTools, check network requests. If they go to `https://your-frontend-host/api/...`, you need to set `REACT_APP_API_URL` to your backend.

- Thumbnails broken or `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`:
  - Use the backend image proxy: set the image `src` to `/api/proxy?url=<encodeURI(your-image-url)>` so the server fetches and streams the image.
  - If a particular CDN host is blocked by the proxy, add its pattern to `ALLOWED_PATTERNS` in `backend/src/routes/proxy.ts`.

- RapidAPI errors:
  - Confirm `RAPIDAPI_KEY` and `RAPIDAPI_HOST` in `.env`.
  - Free-tier providers may not allow listing media — No Baby No Cry depends on media listing, and you may need to upgrade the RapidAPI plan.

---

## Tests & Quality

- Backend tests are configured with Jest (script `npm test`) — consider adding unit tests for `InstagramService`, proxy host rules and `NoBabyNoCryService` parsing.

---

## Security & housekeeping

- DO NOT commit secrets. If keys were committed, rotate them immediately.
- Add rate-limiting and authentication to `/api/proxy` in production to prevent abuse.

---

If you want, I can also add a short `DEPLOY.md` with step-by-step Render UI instructions and screenshots. Tell me which deploy target (Render) you'd like the document tailored to and I'll create it.
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