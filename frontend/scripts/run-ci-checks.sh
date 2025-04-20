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

echo -e "${YELLOW}Running Frontend CI Checks${NC}"
echo "================================================"

if [ "$AUTO_FIX" = true ]; then
  echo -e "${YELLOW}Auto-fix mode enabled. Will attempt to fix issues automatically.${NC}"
fi

# Step 1: Check formatting
echo -e "\n${YELLOW}Step 1/5: Checking code formatting${NC}"
if npm run format:check; then
  echo -e "${GREEN}✓ Formatting checks passed${NC}"
else
  echo -e "${RED}✗ Formatting checks failed${NC}"
  echo -e "${YELLOW}Attempting to fix formatting...${NC}"
  npm run format
  echo -e "${YELLOW}Formatting issues fixed. Please check the changes and commit them.${NC}"
fi

# Step 2: Lint
echo -e "\n${YELLOW}Step 2/5: Running linter${NC}"
if npm run lint; then
  echo -e "${GREEN}✓ Linting checks passed${NC}"
else
  echo -e "${RED}✗ Linting checks failed${NC}"
  if [ "$AUTO_FIX" = true ]; then
    echo -e "${YELLOW}Attempting to fix linting issues...${NC}"
    npm run lint -- --fix
    # Check if the fix was successful
    if npm run lint; then
      echo -e "${GREEN}✓ Linting issues fixed successfully${NC}"
    else
      echo -e "${RED}✗ Some linting issues could not be fixed automatically${NC}"
      echo -e "${YELLOW}Please fix the remaining issues manually and try again${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}Please fix the linting issues and try again, or run with --auto-fix${NC}"
    exit 1
  fi
fi

# Step 3: Type check
echo -e "\n${YELLOW}Step 3/5: Running TypeScript type checking${NC}"
if npm run typecheck; then
  echo -e "${GREEN}✓ TypeScript checks passed${NC}"
else
  echo -e "${RED}✗ TypeScript checks failed${NC}"
  echo -e "${YELLOW}TypeScript errors cannot be fixed automatically.${NC}"
  echo -e "${YELLOW}Please fix the type errors manually and try again.${NC}"
  exit 1
fi

# Step 4: Build
echo -e "\n${YELLOW}Step 4/5: Building project${NC}"
VITE_API_URL="http://localhost:8000/api/v1" \
VITE_SUPABASE_URL="https://example.supabase.co" \
VITE_SUPABASE_ANON_KEY="test-supabase-key" \
VITE_DEV_MODE="false" \
npm run build

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Build succeeded${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  echo -e "${YELLOW}Build errors cannot be fixed automatically.${NC}"
  exit 1
fi

# Step 5: Run tests
echo -e "\n${YELLOW}Step 5/5: Running tests${NC}"
export NODE_OPTIONS="--max-old-space-size=8192"
if npm test -- --coverage; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo -e "${YELLOW}Test failures cannot be fixed automatically.${NC}"
  exit 1
fi

echo -e "\n${GREEN}All checks passed!${NC}"
echo "================================================"
