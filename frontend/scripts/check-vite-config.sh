#!/bin/bash
# Script to check Vite configuration TypeScript validity
# This script is used by the pre-commit hook

set -e

# Navigate to the frontend directory
cd "$(dirname "$0")/.."

echo "Checking Vite configuration..."

# Use TypeScript compiler to check the Vite config
npx tsc vite.config.ts --noEmit

# If we get here, it means the check passed
echo "✅ Vite configuration is valid."