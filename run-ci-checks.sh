#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
RUN_ALL=false
AUTO_FIX=false
CI_COMPATIBLE=false
SKIP_MYPY=false

for arg in "$@"; do
  case $arg in
    --all)
      RUN_ALL=true
      ;;
    --auto-fix)
      AUTO_FIX=true
      ;;
    --ci-compatible)
      CI_COMPATIBLE=true
      SKIP_MYPY=true
      ;;
    --skip-mypy)
      SKIP_MYPY=true
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --all           Run all checks regardless of changed files"
      echo "  --auto-fix      Automatically fix issues when possible"
      echo "  --ci-compatible Make checks match GitHub CI exactly"
      echo "  --skip-mypy     Skip mypy type checking in backend (not run in GitHub CI)"
      echo "  --help          Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${BLUE}Running CI Checks for Both Frontend and Backend${NC}"
echo "================================================"

# Find out if we're on a changed branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" == "main" ]; then
  echo -e "${YELLOW}You are on the main branch.${NC}"
else
  echo -e "${YELLOW}You are on branch: $CURRENT_BRANCH${NC}"
fi

# Check which files changed
FRONTEND_CHANGED=$(git diff --name-only HEAD main | grep -E '^frontend/' || true)
BACKEND_CHANGED=$(git diff --name-only HEAD main | grep -E '^backend/' || true)

# Build arguments for child scripts
ARGS=""
if [ "$AUTO_FIX" = true ]; then
  ARGS="$ARGS --auto-fix"
  echo -e "${YELLOW}Auto-fix mode enabled. Will attempt to fix issues automatically.${NC}"
fi

if [ "$CI_COMPATIBLE" = true ]; then
  ARGS="$ARGS --ci-compatible"
  echo -e "${YELLOW}CI compatibility mode enabled. Checks will match GitHub CI.${NC}"
elif [ "$SKIP_MYPY" = true ]; then
  ARGS="$ARGS --skip-mypy"
  echo -e "${YELLOW}Skipping mypy checks in backend (not run in GitHub CI).${NC}"
fi

# Run frontend checks if frontend files changed or --all flag is passed
if [ -n "$FRONTEND_CHANGED" ] || [ "$RUN_ALL" = true ]; then
  echo -e "\n${BLUE}Frontend files changed, running frontend checks...${NC}"
  pushd frontend > /dev/null
  chmod +x scripts/run-ci-checks.sh
  scripts/run-ci-checks.sh $ARGS
  FRONTEND_RESULT=$?
  popd > /dev/null
  if [ $FRONTEND_RESULT -ne 0 ]; then
    echo -e "${RED}Frontend checks failed.${NC}"
    exit 1
  fi
else
  echo -e "\n${YELLOW}No frontend files changed, skipping frontend checks.${NC}"
  echo -e "${YELLOW}Use --all to run all checks regardless.${NC}"
fi

# Run backend checks if backend files changed or --all flag is passed
if [ -n "$BACKEND_CHANGED" ] || [ "$RUN_ALL" = true ]; then
  echo -e "\n${BLUE}Backend files changed, running backend checks...${NC}"
  pushd backend > /dev/null
  chmod +x scripts/run-ci-checks.sh
  scripts/run-ci-checks.sh $ARGS
  BACKEND_RESULT=$?
  popd > /dev/null
  if [ $BACKEND_RESULT -ne 0 ]; then
    echo -e "${RED}Backend checks failed.${NC}"
    exit 1
  fi
else
  echo -e "\n${YELLOW}No backend files changed, skipping backend checks.${NC}"
  echo -e "${YELLOW}Use --all to run all checks regardless.${NC}"
fi

echo -e "\n${GREEN}All checks passed successfully!${NC}"
echo "================================================"
