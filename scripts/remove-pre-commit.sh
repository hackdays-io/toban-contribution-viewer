#!/usr/bin/env bash

# Script to remove pre-commit hooks and help transition to CI check scripts
# Created as part of the migration away from pre-commit hooks

set -e

YELLOW='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Removing pre-commit hooks from repository...${NC}"

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo -e "${RED}pre-commit is not installed. Skipping uninstall step.${NC}"
else
    # Uninstall the hooks
    echo -e "${YELLOW}Uninstalling pre-commit hooks...${NC}"
    pre-commit uninstall
    echo -e "${GREEN}Pre-commit hooks uninstalled successfully.${NC}"
fi

# Remove the pre-commit hook file directly (in case uninstall didn't work)
if [ -f .git/hooks/pre-commit ]; then
    echo -e "${YELLOW}Removing pre-commit hook file...${NC}"
    rm .git/hooks/pre-commit
    echo -e "${GREEN}Pre-commit hook file removed.${NC}"
fi

# Rename the pre-commit config file to keep it as reference
if [ -f .pre-commit-config.yaml ]; then
    echo -e "${YELLOW}Renaming pre-commit config file to .pre-commit-config.yaml.bak...${NC}"
    mv .pre-commit-config.yaml .pre-commit-config.yaml.bak
    echo -e "${GREEN}Pre-commit config file renamed.${NC}"
fi

echo -e "${GREEN}Pre-commit hooks have been removed successfully!${NC}"
echo -e "${YELLOW}Please use the CI check scripts for code quality checks:${NC}"
echo -e "  ./run-ci-checks.sh             # Run checks on changed files"
echo -e "  ./run-ci-checks.sh --all       # Run all checks"
echo -e "  ./run-ci-checks.sh --auto-fix  # Automatically fix common issues"

# Make script executable
chmod +x $(dirname "$0")/remove-pre-commit.sh