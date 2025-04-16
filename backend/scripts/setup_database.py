#!/usr/bin/env python3
"""
Database Setup Script for Toban Contribution Viewer.

This script initializes the database for the Toban Contribution Viewer.
It is intended to be run once when setting up a new environment.

IMPORTANT: This script will run Alembic migrations, which is the recommended
approach for database schema management. Do not use other direct creation scripts
unless absolutely necessary.

Usage:
    python setup_database.py [--reset]

Options:
    --reset    Reset the database to a clean state (DROP all tables)
               WARNING: Use this with extreme caution, as it will destroy all data.
"""

import argparse
import os
import subprocess  # nosec B404 - subprocess is used safely
import sys
from typing import Tuple

from sqlalchemy import create_engine, engine, text


def check_environment() -> None:
    """Check if we're in production environment."""
    is_production = os.environ.get("ENVIRONMENT") == "production"
    if is_production:
        print("WARNING: This script should NOT be run in production!")
        response = input(
            "Are you sure you want to continue? This will DESTROY ALL DATA! (yes/no): "
        )
        if response.lower() != "yes":
            print("Operation cancelled.")
            sys.exit(1)
        print("CAUTION: Proceeding with database setup in PRODUCTION environment!")


def get_database_url() -> str:
    """Get the database URL from environment variables or use default."""
    return os.environ.get(
        "DATABASE_URL", "postgresql://toban_admin:postgres@postgres/tobancv"
    )


def reset_database(db_engine: engine.Engine) -> None:
    """Reset the database by dropping all tables and alembic version info."""
    print("Resetting database...")

    # Drop all tables and recreate public schema
    reset_sql = """
    -- Drop schema and recreate it
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO toban_admin;
    GRANT ALL ON SCHEMA public TO public;

    -- Drop enums if they exist
    DROP TYPE IF EXISTS teammemberrole CASCADE;
    DROP TYPE IF EXISTS integrationtype CASCADE;
    DROP TYPE IF EXISTS integrationstatus CASCADE;
    DROP TYPE IF EXISTS credentialtype CASCADE;
    DROP TYPE IF EXISTS sharelevel CASCADE;
    DROP TYPE IF EXISTS resourcetype CASCADE;
    DROP TYPE IF EXISTS accesslevel CASCADE;
    DROP TYPE IF EXISTS eventtype CASCADE;
    """

    with db_engine.connect() as conn:
        conn.execute(text(reset_sql))
        conn.commit()

    print("Database reset completed.")


def run_alembic_command(command: str, target: str) -> Tuple[bool, str, str]:
    """Run an Alembic command either directly or through Docker.

    Args:
        command: The Alembic command to run (e.g., 'upgrade', 'stamp')
        target: The target revision (e.g., 'head', 'consolidated_schema')

    Returns:
        tuple: (success, stdout, stderr)
    """
    inside_docker = os.path.exists("/.dockerenv")

    try:
        if inside_docker:
            # Inside Docker container
            cmd = ["alembic", command, target]
        else:
            # Outside Docker
            cmd = ["docker", "exec", "tobancv-backend", "alembic", command, target]

        # We're using fixed command strings, so this is safe
        result = subprocess.run(  # nosec
            cmd,
            check=True,
            capture_output=True,
        )
        return True, result.stdout.decode("utf-8"), ""
    except subprocess.CalledProcessError as e:
        return False, e.stdout.decode("utf-8"), e.stderr.decode("utf-8")


def run_alembic_migrations() -> None:
    """Run Alembic migrations to set up the database schema."""
    print("Running Alembic migrations...")

    # First try running the consolidated migration directly
    success, stdout, stderr = run_alembic_command("upgrade", "consolidated_schema")

    if success:
        print("Database migrations completed successfully with consolidated schema.")
        print(stdout)
        return
    else:
        print(
            "Consolidated migration had issues, will try regular migration sequence..."
        )
        print(stdout)
        print(stderr)

    # If consolidated migration failed, try the normal migration path to head
    success, stdout, stderr = run_alembic_command("upgrade", "head")

    if success:
        print("Database migrations completed successfully with regular sequence.")
        print(stdout)
    else:
        print("Error running migrations")
        print(stdout)
        print(stderr)

        # Check if certain errors are in the output that we can safely ignore
        if "DuplicateObject" in stderr and ("already exists" in stderr):
            print("\nWARNING: Some objects already exist in the database.")
            print("This is typically fine for development environments.")
            print("Database is likely in a usable state. Continuing...")
        else:
            sys.exit(1)

    # Make sure the database has the proper Alembic version stamped
    # This helps when the tables exist but Alembic's version tracking gets out of sync
    print("\nStamping database with consolidated schema version...")
    success, stdout, stderr = run_alembic_command("stamp", "consolidated_schema")

    if success:
        print("Database version stamped successfully.")
        print(stdout)
    else:
        print("Warning: Could not stamp database version.")
        print(stdout)
        print(stderr)
        print("This is not critical and the database should still work correctly.")


def create_test_data(db_engine: engine.Engine) -> None:
    """Create test data for development purposes."""
    print("Creating test data...")

    # Add your test data creation here
    # For example, create a test team and users

    # Check if test team already exists
    test_team_exists_sql = """
    SELECT 1 FROM team WHERE id = '2eef945e-9596-4f8c-8cd0-761698121912'
    """

    with db_engine.connect() as conn:
        result = conn.execute(text(test_team_exists_sql))
        exists = result.scalar() is not None

    if not exists:
        print("Creating test team...")

        # Insert test team
        test_team_sql = """
        INSERT INTO team (
            id, name, slug, description, team_size, is_personal,
            created_by_user_id, created_at, updated_at, is_active
        ) VALUES (
            '2eef945e-9596-4f8c-8cd0-761698121912',
            'Test Team',
            'test-team',
            'A test team for development',
            0,
            false,
            '98765432-1234-5678-9012-345678901234',
            NOW(),
            NOW(),
            true
        ) ON CONFLICT DO NOTHING
        """

        # Insert test team member
        test_member_sql = """
        INSERT INTO teammember (
            id, user_id, email, display_name, role, invitation_status,
            team_id, created_at, updated_at, is_active
        ) VALUES (
            '3aaf956e-8686-5f9d-9dd0-862698132823',
            '98765432-1234-5678-9012-345678901234',
            'test@example.com',
            'Test User',
            'OWNER',
            'accepted',
            '2eef945e-9596-4f8c-8cd0-761698121912',
            NOW(),
            NOW(),
            true
        ) ON CONFLICT DO NOTHING
        """

        with db_engine.connect() as conn:
            conn.execute(text(test_team_sql))
            conn.execute(text(test_member_sql))
            conn.commit()

        print("Test data created successfully.")
    else:
        print("Test team already exists, skipping test data creation.")


def main() -> None:
    """Initialize and set up the database."""
    parser = argparse.ArgumentParser(
        description="Setup database for Toban Contribution Viewer"
    )
    parser.add_argument(
        "--reset", action="store_true", help="Reset the database to a clean state"
    )
    args = parser.parse_args()

    # Check environment
    check_environment()

    # Get database URL
    database_url = get_database_url()

    # Create engine
    db_engine = create_engine(database_url)

    # Reset database if requested
    if args.reset:
        reset_database(db_engine)

    # Run migrations
    run_alembic_migrations()

    # Create test data for development
    if os.environ.get("ENVIRONMENT") != "production":
        create_test_data(db_engine)

    print("Database setup completed successfully.")


if __name__ == "__main__":
    main()
