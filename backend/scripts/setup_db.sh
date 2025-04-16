#!/bin/bash
# Setup Script for Toban Contribution Viewer Database
# This script:
# 1. Makes the setup_database.py script executable
# 2. Runs it within the backend Docker container

set -e  # Exit on error

echo "Starting database setup..."

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if the container is running
if ! docker ps | grep -q tobancv-backend; then
    echo "Error: The backend container is not running. Please start it with:"
    echo "docker-compose up -d"
    exit 1
fi

# Make setup_database.py executable just in case
docker exec tobancv-backend chmod +x /app/scripts/setup_database.py

# Run the setup script
echo "Running database setup script..."
docker exec tobancv-backend python /app/scripts/setup_database.py "$@"

# Check if successful
if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "You can now start using the application."
    echo "Check the database tables with:"
    echo "docker exec tobancv-postgres psql -U toban_admin -d tobancv -c '\dt'"
else
    echo "❌ Database setup failed."
    echo "Please check the error messages above."
fi
