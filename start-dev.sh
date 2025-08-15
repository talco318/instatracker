#!/bin/bash

echo "🚀 Starting InstaTracker Development Setup"

# Start MongoDB
echo "📦 Starting MongoDB..."
if command -v mongod &> /dev/null; then
    mongod --fork --logpath /var/log/mongodb.log --dbpath /var/lib/mongodb
    echo "✅ MongoDB started"
else
    echo "❌ MongoDB not found. Please install MongoDB first."
    echo "Visit: https://docs.mongodb.com/manual/installation/"
    exit 1
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Creating .env file from template..."
    cp backend/.env.example backend/.env
    echo "📝 Please edit backend/.env with your actual values:"
    echo "   - RAPIDAPI_KEY"
    echo "   - JWT_SECRET"
    echo "   - Email service configuration"
    echo "   - MongoDB URI (if different)"
    read -p "Press Enter after updating .env file..."
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "instatracker/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd instatracker && npm install && cd ..
fi

echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Terminal 1: cd backend && npm run dev"
echo "2. Terminal 2: cd instatracker && npm start"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:5000"