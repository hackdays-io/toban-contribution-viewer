#!/bin/bash
# Script to simplify Docker operations for development

# Make the script exit on error
set -e

# Color codes for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
  echo -e "${GREEN}[Docker Dev]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[Warning]${NC} $1"
}

print_error() {
  echo -e "${RED}[Error]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
}

# Initialize environment files if they don't exist
init_env_files() {
  if [ ! -f .env.docker ]; then
    print_message "Creating .env.docker from example file..."
    cp .env.docker.example .env.docker
    print_warning "Please edit .env.docker with your actual credentials."
  fi

  if [ ! -f frontend/.env ]; then
    print_message "Creating frontend/.env from example file..."
    cp frontend/.env.example frontend/.env
  fi

  if [ ! -f backend/.env ]; then
    print_message "Creating backend/.env from example file..."
    cp backend/.env.example backend/.env
  fi
}

# Start the development environment
start_dev() {
  print_message "Starting development environment..."
  docker compose --env-file .env.docker up -d
  print_message "Development environment is running!"
  print_message "Frontend: http://localhost:5173"
  print_message "Backend API: http://localhost:8000"
  print_message "API Documentation: http://localhost:8000/docs"
}

# Stop the development environment
stop_dev() {
  print_message "Stopping development environment..."
  docker compose --env-file .env.docker down
  print_message "Development environment stopped."
}

# Restart the development environment
restart_dev() {
  print_message "Restarting development environment..."
  docker compose --env-file .env.docker restart
  print_message "Development environment restarted."
}

# Rebuild containers
rebuild() {
  print_message "Rebuilding containers..."
  docker compose --env-file .env.docker build
  print_message "Containers rebuilt. Run './docker-dev.sh start' to start them."
}

# Execute a command in the backend container
backend_exec() {
  if [ $# -eq 0 ]; then
    print_error "Please provide a command to execute in the backend container."
    exit 1
  fi

  print_message "Executing in backend container: $*"
  docker compose exec backend "$@"
}

# Execute a command in the frontend container
frontend_exec() {
  if [ $# -eq 0 ]; then
    print_error "Please provide a command to execute in the frontend container."
    exit 1
  fi

  print_message "Executing in frontend container: $*"
  docker compose exec frontend "$@"
}

# Show logs
show_logs() {
  if [ $# -eq 0 ]; then
    print_message "Showing logs for all services..."
    docker compose logs -f
  else
    print_message "Showing logs for service: $1"
    docker compose logs -f "$1"
  fi
}

# Run backend tests
backend_test() {
  print_message "Running backend tests..."
  docker compose exec backend pytest "$@"
}

# Run frontend tests
frontend_test() {
  print_message "Running frontend tests..."
  docker compose exec frontend npm test "$@"
}

# Main function to handle commands
main() {
  check_docker

  case "$1" in
    start)
      init_env_files
      start_dev
      ;;
    stop)
      stop_dev
      ;;
    restart)
      restart_dev
      ;;
    rebuild)
      rebuild
      ;;
    logs)
      shift
      show_logs "$@"
      ;;
    backend)
      shift
      backend_exec "$@"
      ;;
    frontend)
      shift
      frontend_exec "$@"
      ;;
    test-backend)
      shift
      backend_test "$@"
      ;;
    test-frontend)
      shift
      frontend_test "$@"
      ;;
    *)
      echo "Usage: $0 {start|stop|restart|rebuild|logs|backend|frontend|test-backend|test-frontend}"
      echo ""
      echo "Commands:"
      echo "  start           - Start the development environment"
      echo "  stop            - Stop the development environment"
      echo "  restart         - Restart the development environment"
      echo "  rebuild         - Rebuild containers"
      echo "  logs [service]  - Show logs (optional: specify service name)"
      echo "  backend cmd     - Run command in backend container"
      echo "  frontend cmd    - Run command in frontend container"
      echo "  test-backend    - Run backend tests"
      echo "  test-frontend   - Run frontend tests"
      exit 1
      ;;
  esac
}

# Run the main function with all command line arguments
main "$@"
