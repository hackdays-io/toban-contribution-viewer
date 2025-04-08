#!/usr/bin/env python
"""
Script to check environment variables before running the application.
This can be used in CI/CD pipelines to validate environment configuration.
"""

import argparse
import os
import sys
from pathlib import Path

# Add the parent directory to sys.path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set environment variables for testing if we're in CI mode
if os.environ.get("CI") == "true":
    os.environ["TESTING"] = "True"

from app.core.env_test import check_env  # noqa: E402


def main():
    parser = argparse.ArgumentParser(
        description="Check environment variables configuration"
    )
    parser.add_argument(
        "--env-file", "-e", help="Path to .env file to check", default=".env"
    )
    parser.add_argument(
        "--no-exit",
        "-n",
        help="Don't exit with error code if validation fails",
        action="store_true",
    )

    args = parser.parse_args()
    env_file = args.env_file if os.path.exists(args.env_file) else None

    if env_file:
        print(f"Checking environment variables from file: {env_file}")
    else:
        print("Checking environment variables from current environment")

    check_env(env_file=env_file, exit_on_error=not args.no_exit)


if __name__ == "__main__":
    main()
