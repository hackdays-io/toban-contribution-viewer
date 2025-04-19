#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Parse arguments
AUTO_FIX=false
SKIP_MYPY=false
CI_COMPATIBLE=false

for arg in "$@"; do
  case $arg in
    --auto-fix)
      AUTO_FIX=true
      ;;
    --skip-mypy)
      SKIP_MYPY=true
      ;;
    --ci-compatible)
      CI_COMPATIBLE=true
      SKIP_MYPY=true
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --auto-fix       Automatically fix issues when possible"
      echo "  --skip-mypy      Skip mypy type checking (not run in GitHub CI)"
      echo "  --ci-compatible  Make checks match GitHub CI exactly (includes --skip-mypy)"
      echo "  --help           Show this help message"
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
if [ -z "$VIRTUAL_ENV" ] && [ "$CI" != "true" ]; then
  echo -e "${RED}Error: Not running in a Python virtual environment.${NC}"
  echo -e "${YELLOW}Please activate your virtual environment and try again.${NC}"
  echo -e "${YELLOW}If you are in CI environment, set CI=true environment variable.${NC}"
  exit 1
fi

# Create a test environment file if needed for CI or local testing
if [ ! -f .env.test ] && [ "$TESTING" = "True" ]; then
  echo -e "${YELLOW}Creating test environment file...${NC}"
  echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db" > .env.test
  echo "DATABASE_TEST_URL=postgresql://postgres:postgres@localhost:5432/test_db" >> .env.test
  echo "SECRET_KEY=test-secret-key-for-ci" >> .env.test
  echo "SUPABASE_URL=https://example.supabase.co" >> .env.test
  echo "SUPABASE_KEY=test-supabase-key" >> .env.test
  echo "SUPABASE_JWT_SECRET=test-jwt-secret" >> .env.test
  echo "OPENAI_API_KEY=sk-test-key" >> .env.test
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

# Check if we're in a local environment with additional plugins
FLAKE8_IGNORE="C901,E501,W503,W293,E203"

# Add ignore rules for common plugins that might be installed locally but not in CI
INSTALLED_PLUGINS=$(pip list 2>/dev/null | grep -i flake8 | grep -v "^flake8 " || echo "")
if echo "$INSTALLED_PLUGINS" | grep -q "flake8-quotes"; then
  echo -e "${YELLOW}Detected flake8-quotes plugin - adding Q000 to ignore list${NC}"
  FLAKE8_IGNORE="${FLAKE8_IGNORE},Q000"
fi

if echo "$INSTALLED_PLUGINS" | grep -q "flake8-docstrings"; then
  echo -e "${YELLOW}Detected flake8-docstrings plugin - adding D100-D999 to ignore list${NC}"
  FLAKE8_IGNORE="${FLAKE8_IGNORE},D100,D101,D102,D103,D104,D105,D106,D107,D200,D205,D400,D401,D403,D415"
fi

if echo "$INSTALLED_PLUGINS" | grep -q "flake8-bugbear"; then
  echo -e "${YELLOW}Detected flake8-bugbear plugin - adding B950 to ignore list${NC}"
  FLAKE8_IGNORE="${FLAKE8_IGNORE},B950"
fi

echo -e "${YELLOW}Using flake8 ignore rules: ${FLAKE8_IGNORE}${NC}"

if flake8 . --count --max-complexity=10 --max-line-length=120 --statistics --ignore=$FLAKE8_IGNORE --exclude=alembic/*,venv/*,__pycache__/*; then
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
    if flake8 . --count --max-complexity=10 --max-line-length=120 --statistics --ignore=$FLAKE8_IGNORE --exclude=alembic/*,venv/*,__pycache__/*; then
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

# Step 4: Check environment variables
echo -e "\n${YELLOW}Step 4/6: Checking environment variables${NC}"
if [ -f ".env.test" ]; then
  if python scripts/check_env.py --env-file .env.test --no-exit; then
    echo -e "${GREEN}✓ Environment variable check passed${NC}"
  else
    echo -e "${YELLOW}Warning: Some environment variables might be missing${NC}"
    echo -e "${YELLOW}This might cause tests to fail if environment is not set up correctly${NC}"
  fi
else
  echo -e "${YELLOW}Skipping environment check (no .env.test file)${NC}"
  echo -e "${YELLOW}If running tests, make sure your environment is properly configured${NC}"
fi

# Step 5: mypy (optional - not run in GitHub CI)
if [ "$SKIP_MYPY" = true ]; then
  echo -e "\n${YELLOW}Step 5/6: Skipping mypy type checking (--skip-mypy flag used)${NC}"
  echo -e "${YELLOW}Note: GitHub CI does not run mypy checks${NC}"
else
  echo -e "\n${YELLOW}Step 5/6: Running mypy${NC}"
  echo -e "${YELLOW}Note: GitHub CI doesn't run mypy. Use --skip-mypy to skip this step.${NC}"
  if mypy --ignore-missing-imports app/; then
    echo -e "${GREEN}✓ mypy checks passed${NC}"
  else
    echo -e "${RED}✗ mypy checks failed${NC}"
    echo -e "${YELLOW}Type errors cannot be fixed automatically.${NC}"
    echo -e "${YELLOW}Please fix the type errors manually and try again.${NC}"
    echo -e "${YELLOW}Alternatively, use --skip-mypy to skip mypy checks (like GitHub CI).${NC}"
    exit 1
  fi
fi

# Step 6: Run tests
echo -e "\n${YELLOW}Step 6/6: Running tests${NC}"
if pytest --cov=app --cov-report=term-missing; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo -e "${YELLOW}Test failures cannot be fixed automatically.${NC}"
  exit 1
fi

echo -e "\n${GREEN}All checks passed!${NC}"
echo "================================================"
