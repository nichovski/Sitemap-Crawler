#!/bin/bash
# Development start script for Sitemap Crawler

echo "🚀 Starting Sitemap Crawler in Development Mode"
echo ""
echo "This will start:"
echo "  - Backend on http://localhost:3001"
echo "  - Frontend on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo "Starting Backend..."
cd backend
node server.js &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
cd ..

# Wait a moment for backend to start
sleep 2

# Start Frontend
echo "Starting Frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "✨ Both servers are running!"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for user interrupt
wait
