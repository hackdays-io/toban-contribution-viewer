#!/bin/sh
set -e

echo "Waiting for services to be ready..."

echo "Waiting for backend..."
until wget -q -O - http://test-backend:8000/health > /dev/null 2>&1; do
  echo "Backend is unavailable - sleeping"
  sleep 2
done
echo "Backend is up!"

echo "Waiting for mock Slack API..."
until wget -q -O - http://mock-slack-api:3000/health > /dev/null 2>&1; do
  echo "Mock Slack API is unavailable - sleeping"
  sleep 2
done
echo "Mock Slack API is up!"

echo "Waiting for mock OpenRouter API..."
until wget -q -O - http://mock-openrouter-api:3000/health > /dev/null 2>&1; do
  echo "Mock OpenRouter API is unavailable - sleeping"
  sleep 2
done
echo "Mock OpenRouter API is up!"

echo "All services are ready!"

exec "$@"
