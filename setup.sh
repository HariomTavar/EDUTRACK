#!/bin/bash
# EduTrack Quick Start Script

echo "🚀 EduTrack - Smart Classroom Management System"
echo "==============================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if MongoDB is running
echo "Checking MongoDB..."
if mongosh --version &> /dev/null; then
    echo "✅ MongoDB CLI found"
else
    echo "⚠️  MongoDB CLI not found. Make sure MongoDB is running."
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install backend dependencies
echo "📥 Backend dependencies..."
cd backend
npm install --quiet
echo "✅ Backend ready"
cd ..

# Install frontend dependencies
echo ""
echo "📥 Frontend dependencies..."
cd frontend
npm install --quiet
echo "✅ Frontend ready"
cd ..

echo ""
echo "✨ Setup complete!"
echo ""
echo "🎯 To start the app, run these in separate terminals:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ cd frontend && npm run dev"
echo ""
echo "📍 Then open: http://localhost:5173"
echo ""
echo "💡 For detailed setup, see IMPLEMENTATION_GUIDE.md"
