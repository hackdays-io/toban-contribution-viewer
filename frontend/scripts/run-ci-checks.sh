#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running Frontend CI Checks${NC}"
echo "================================================"

# Step 1: Check formatting
echo -e "\n${YELLOW}Step 1/5: Checking code formatting${NC}"
if npm run format:check; then
  echo -e "${GREEN}✓ Formatting checks passed${NC}"
else
  echo -e "${RED}✗ Formatting checks failed${NC}"
  echo -e "${YELLOW}Attempting to fix formatting...${NC}"
  npm run format
  echo -e "${YELLOW}Please check the changes and commit them if needed${NC}"
fi

# Step 2: Lint
echo -e "\n${YELLOW}Step 2/5: Running linter${NC}"
if npm run lint; then
  echo -e "${GREEN}✓ Linting checks passed${NC}"
else
  echo -e "${RED}✗ Linting checks failed${NC}"
  echo -e "${YELLOW}Please fix the linting issues and try again${NC}"
  exit 1
fi

# Step 3: Type check
echo -e "\n${YELLOW}Step 3/5: Running TypeScript type checking${NC}"
if npm run typecheck; then
  echo -e "${GREEN}✓ TypeScript checks passed${NC}"
else
  echo -e "${RED}✗ TypeScript checks failed${NC}"
  echo -e "${YELLOW}Please fix the type errors and try again${NC}"
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
  exit 1
fi

# Step 5: Run tests
echo -e "\n${YELLOW}Step 5/5: Running tests${NC}"
export NODE_OPTIONS="--max-old-space-size=8192"
if npm test -- --coverage; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  exit 1
fi

echo -e "\n${GREEN}All checks passed!${NC}"
echo "================================================"