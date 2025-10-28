#!/bin/bash
# Build script for Sitemap Crawler

echo "🔨 Building Sitemap Crawler..."
echo ""

# Build Backend
echo "📦 Checking Backend..."
cd backend
if node -c server.js; then
    echo "✅ Backend syntax check passed"
else
    echo "❌ Backend has syntax errors!"
    exit 1
fi
cd ..
echo ""

# Build Frontend
echo "📦 Building Frontend..."
cd frontend
if npm run build; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed!"
    exit 1
fi
cd ..
echo ""

echo "🎉 Build completed successfully!"
echo ""
echo "To start the application:"
echo "  Backend:  cd backend && node server.js"
echo "  Frontend: cd frontend && npm start"
