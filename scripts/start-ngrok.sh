#!/bin/bash
# Script to start ngrok for Slack OAuth
# Usage: ./start-ngrok.sh [authtoken]

set -e

# Check if authtoken is provided as argument or in .env.ngrok file
if [ -n "$1" ]; then
  NGROK_AUTHTOKEN="$1"
elif [ -f ".env.ngrok" ]; then
  source .env.ngrok
else
  echo "Error: Ngrok authtoken required."
  echo "Either provide it as an argument: ./start-ngrok.sh your_authtoken"
  echo "Or create a .env.ngrok file with: NGROK_AUTHTOKEN=your_authtoken"
  exit 1
fi

if [ -z "$NGROK_AUTHTOKEN" ]; then
  echo "Error: NGROK_AUTHTOKEN is not set"
  exit 1
fi

# Create temporary ngrok config
TMP_CONFIG="./temp-ngrok.yml"

echo "Creating temporary ngrok configuration..."
cat > "$TMP_CONFIG" << EOF
version: 2
authtoken: $NGROK_AUTHTOKEN
web_addr: 0.0.0.0:4040
tunnels:
  app:
    proto: http
    addr: http://localhost:5173
    inspect: false
    hostname: ${NGROK_CUSTOM_DOMAIN:-}
EOF

# Function to clean up on exit
cleanup() {
  echo "Cleaning up temporary files..."
  rm -f "$TMP_CONFIG"
}

# Register the cleanup function to be called on exit
trap cleanup EXIT

echo "Starting ngrok for frontend (http://localhost:5173)..."
echo "Press Ctrl+C to stop"
echo ""
echo "Once ngrok is running, update your .env.docker file with:"
echo "NGROK_URL=https://your-ngrok-url.ngrok-free.app"
echo ""
echo "And configure your Slack App's redirect URL to:"
echo "https://your-ngrok-url.ngrok-free.app/auth/slack/callback"
echo ""

# Start ngrok
ngrok start --config="$TMP_CONFIG" app