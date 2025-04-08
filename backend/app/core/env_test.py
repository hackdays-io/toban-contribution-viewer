"""
Utility for testing environment variable configurations.
This module helps verify that all required environment variables are present
and properly formatted before the application starts.
"""

import os
import sys
from typing import Dict, List, Optional

from pydantic import ValidationError

from app.config import Settings


def test_env_vars(env_file: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Test environment variables configuration.

    Args:
        env_file: Optional path to an environment file to test.

    Returns:
        Dict with 'missing' and 'invalid' lists of environment variables.
    """
    result = {
        "missing": [],
        "invalid": [],
    }

    # If env_file is provided, read environment variables from it
    if env_file and os.path.exists(env_file):
        env_vars = {}
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                key, value = line.split("=", 1)
                env_vars[key] = value
    else:
        env_vars = os.environ.copy()

    # Try to create settings from environment variables
    try:
        Settings(**env_vars)
    except ValidationError as e:
        for error in e.errors():
            field = error["loc"][0]
            if "missing" in error["msg"]:
                result["missing"].append(field)
            else:
                result["invalid"].append(field)

    return result


def check_env(env_file: Optional[str] = None, exit_on_error: bool = True) -> bool:
    """
    Check environment variables and optionally exit if any are missing or invalid.

    Args:
        env_file: Optional path to an environment file to test.
        exit_on_error: Whether to exit the application if any variables are missing/invalid.

    Returns:
        True if all environment variables are valid, False otherwise.
    """
    result = test_env_vars(env_file)

    if result["missing"] or result["invalid"]:
        print("Environment variable configuration errors:")

        if result["missing"]:
            print("Missing variables:")
            for var in result["missing"]:
                print(f"  - {var}")

        if result["invalid"]:
            print("Invalid variables:")
            for var in result["invalid"]:
                print(f"  - {var}")

        if exit_on_error:
            print("Exiting due to environment configuration errors.")
            sys.exit(1)

        return False

    return True
