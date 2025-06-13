#!/bin/bash
set -e

echo "🚀 Publishing Wappler Cleanup Tool to npm..."

# Change to the correct directory
cd "$(dirname "$0")"

# Verify we're in the right place
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run a quick test
echo "🧪 Testing tool..."
node bin/cli.js --help

# Publish to npm
echo "📤 Publishing to npm..."
npm publish --access public

echo "✅ Successfully published to npm!"
echo "🎉 Install with: npm install -g wappler-cleanup-tool"
echo "🎉 Or use with: npx wappler-cleanup-tool"