#!/bin/bash

# Exit on error
set -e

echo "🚀 Building main package..."
pnpm build

echo "📦 Building sample project..."
(cd sample && pnpm build)

echo "👀 Starting preview..."
(cd sample && pnpm preview)

echo "✅ Preview stopped. You are back in root."
