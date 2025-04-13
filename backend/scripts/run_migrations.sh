#!/bin/bash
# Script to run database migrations inside the Docker container

# Check if the backend container is running
if ! docker ps | grep -q tobancv-backend; then
  echo "Error: tobancv-backend container is not running"
  echo "Please start your Docker services with: docker-compose up -d"
  exit 1
fi

echo "Running database migrations..."
docker exec tobancv-backend alembic upgrade head

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "✅ Database migrations completed successfully"
else
  echo "❌ Database migrations failed"
  exit 1
fi
