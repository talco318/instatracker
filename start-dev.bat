@echo off
echo 🚀 Starting InstaTracker Development Setup

REM Check if .env exists
if not exist "backend\.env" (
    echo ⚠️ Creating .env file from template...
    copy "backend\.env.example" "backend\.env"
    echo 📝 Please edit backend\.env with your actual values:
    echo    - RAPIDAPI_KEY
    echo    - JWT_SECRET
    echo    - Email service configuration
    echo    - MongoDB URI ^(if different^)
    pause
)

REM Install dependencies if needed
if not exist "backend\node_modules" (
    echo 📦 Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

if not exist "instatracker\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd instatracker
    npm install
    cd ..
)

echo 🎉 Setup complete!
echo.
echo To start the application:
echo 1. Terminal 1: cd backend ^&^& npm run dev
echo 2. Terminal 2: cd instatracker ^&^& npm start
echo.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
pause