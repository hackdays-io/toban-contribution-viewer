#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Parse arguments
AUTO_FIX=false

for arg in "$@"; do
  case $arg in
    --auto-fix)
      AUTO_FIX=true
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --auto-fix  Automatically fix issues when possible"
      echo "  --help      Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${YELLOW}Running Backend CI Checks${NC}"
echo "================================================"

if [ "$AUTO_FIX" = true ]; then
  echo -e "${YELLOW}Auto-fix mode enabled. Will attempt to fix issues automatically.${NC}"
fi

# Check if we're in a Python virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
  echo -e "${RED}Error: Not running in a Python virtual environment.${NC}"
  echo -e "${YELLOW}Please activate your virtual environment and try again.${NC}"
  exit 1
fi

# Step 1: Black formatting
echo -e "\n${YELLOW}Step 1/5: Running Black formatter${NC}"
if black --check .; then
  echo -e "${GREEN}✓ Black formatting checks passed${NC}"
else
  echo -e "${RED}✗ Black formatting checks failed${NC}"
  echo -e "${YELLOW}Applying Black formatting...${NC}"
  black .
  echo -e "${YELLOW}Formatting issues fixed. Please check the changes and commit them.${NC}"
fi

# Step 2: isort
echo -e "\n${YELLOW}Step 2/5: Running isort${NC}"
if isort --check-only --profile black .; then
  echo -e "${GREEN}✓ isort checks passed${NC}"
else
  echo -e "${RED}✗ isort checks failed${NC}"
  echo -e "${YELLOW}Applying isort changes...${NC}"
  isort --profile black .
  echo -e "${YELLOW}Import sorting issues fixed. Please check the changes and commit them.${NC}"
fi

# Step 3: flake8
echo -e "\n${YELLOW}Step 3/5: Running flake8${NC}"
if flake8 --max-complexity=10 --max-line-length=120 --ignore=E203,W503,D100,D104,D107 --exclude=alembic/*,venv/*,__pycache__/* .; then
  echo -e "${GREEN}✓ flake8 checks passed${NC}"
else
  echo -e "${RED}✗ flake8 checks failed${NC}"
  if [ "$AUTO_FIX" = true ]; then
    echo -e "${YELLOW}Attempting to fix simple flake8 issues...${NC}"
    
    # Handle unused imports using autoflake
    if command -v autoflake &> /dev/null; then
      echo -e "${YELLOW}Running autoflake to remove unused imports...${NC}"
      autoflake --remove-all-unused-imports --recursive --in-place --exclude=venv,alembic,__pycache__ .
    else
      echo -e "${YELLOW}autoflake not found. Install with 'pip install autoflake' for better auto-fixing.${NC}"
    fi
    
    # Run flake8 again to see if the issues were fixed
    if flake8 --max-complexity=10 --max-line-length=120 --ignore=E203,W503,D100,D104,D107 --exclude=alembic/*,venv/*,__pycache__/* .; then
      echo -e "${GREEN}✓ flake8 issues fixed successfully${NC}"
    else
      echo -e "${RED}✗ Some flake8 issues could not be fixed automatically${NC}"
      echo -e "${YELLOW}Please fix the remaining issues manually and try again${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}Please fix the flake8 issues and try again, or run with --auto-fix${NC}"
    exit 1
  fi
fi

# Step 4: mypy
echo -e "\n${YELLOW}Step 4/5: Running mypy${NC}"
if mypy --ignore-missing-imports --disallow-untyped-defs --disallow-incomplete-defs --check-untyped-defs app/; then
  echo -e "${GREEN}✓ mypy checks passed${NC}"
else
  echo -e "${RED}✗ mypy checks failed${NC}"
  echo -e "${YELLOW}Type errors cannot be fixed automatically.${NC}"
  echo -e "${YELLOW}Please fix the type errors manually and try again.${NC}"
  exit 1
fi

# Step 5: Run tests
echo -e "\n${YELLOW}Step 5/5: Running tests${NC}"
if pytest --cov=app --cov-report=term-missing; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo -e "${YELLOW}Test failures cannot be fixed automatically.${NC}"
  exit 1
fi

echo -e "\n${GREEN}All checks passed!${NC}"
echo "================================================"
