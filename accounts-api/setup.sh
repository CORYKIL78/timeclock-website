#!/bin/bash
# Quick setup script for Accounts API

set -e

echo "🚀 Setting up Accounts API..."
echo ""

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Navigate to accounts-api directory
cd accounts-api || { echo "❌ accounts-api directory not found"; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit accounts-api/.env and add your MongoDB URI"
    echo "   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/timeclock"
    echo ""
    echo "   Get free MongoDB: https://www.mongodb.com/cloud/atlas"
    echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env and add MONGODB_URI"
echo "   2. Run: npm start"
echo "   3. Add to your HTML:"
echo "      localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');"
echo ""
