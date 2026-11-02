#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  =========================================="
echo "   Claude Workbench"
echo "  =========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed or not in PATH."
    echo "  Install it from https://nodejs.org"
    exit 1
fi

# Install deps if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "  [SETUP] Installing dependencies..."
    npm install
    echo ""
fi

# Build if no build output exists
if [ ! -d "server/dist" ] || [ ! -d "client/.next" ]; then
    echo "  [BUILD] Building project..."
    npm run build
    echo ""
fi

echo "  Starting production servers..."
echo "  Frontend: http://localhost:4200"
echo "  Backend:  http://localhost:4201"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

npm run start
