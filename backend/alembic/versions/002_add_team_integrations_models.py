"""Add team integrations models

Revision ID: 002_add_team_integrations_models
Revises: fe6424d2cda2
Create Date: 2025-04-15 01:25:00

"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "002_add_team_integrations_models"
down_revision = "fe6424d2cda2"
branch_labels = None
depends_on = None


def upgrade():
    # Create IntegrationType enum
    integration_type = sa.Enum(
        "slack", "github", "notion", "discord", name="integrationtype"
    )
    integration_type.create(op.get_bind())

    # Create IntegrationStatus enum
    integration_status = sa.Enum(
        "active",
        "disconnected",
        "expired",
        "revoked",
        "error",
        name="integrationstatus",
    )
    integration_status.create(op.get_bind())

    # Create CredentialType enum
    credential_type = sa.Enum(
        "oauth_token", "personal_token", "api_key", "app_token", name="credentialtype"
    )
    credential_type.create(op.get_bind())

    # Create ShareLevel enum
    share_level = sa.Enum(
        "full_access", "limited_access", "read_only", name="sharelevel"
    )
    share_level.create(op.get_bind())

    # Create ResourceType enum
    resource_type = sa.Enum(
        "slack_channel",
        "slack_user",
        "slack_emoji",
        "github_repository",
        "github_issue",
        "github_pr",
        "github_webhook",
        "notion_page",
        "notion_database",
        "notion_block",
        "discord_guild",
        "discord_channel",
        name="resourcetype",
    )
    resource_type.create(op.get_bind())

    # Create AccessLevel enum
    access_level = sa.Enum("read", "write", "admin", name="accesslevel")
    access_level.create(op.get_bind())

    # Create EventType enum
    event_type = sa.Enum(
        "created",
        "shared",
        "unshared",
        "updated",
        "disconnected",
        "access_changed",
        "error",
        name="eventtype",
    )
    event_type.create(op.get_bind())

    # Create Integration table
    op.create_table(
        "integration",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "service_type",
            sa.Enum("slack", "github", "notion", "discord", name="integrationtype"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "disconnected",
                "expired",
                "revoked",
                "error",
                name="integrationstatus",
            ),
            nullable=False,
            default="active",
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("owner_team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_user_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["owner_team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integration_owner_team_id"),
        "integration",
        ["owner_team_id"],
        unique=False,
    )

    # Create IntegrationCredential table
    op.create_table(
        "integrationcredential",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "credential_type",
            sa.Enum(
                "oauth_token",
                "personal_token",
                "api_key",
                "app_token",
                name="credentialtype",
            ),
            nullable=False,
        ),
        sa.Column("encrypted_value", sa.String(2048), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("refresh_token", sa.String(2048), nullable=True),
        sa.Column("scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"],
            ["integration.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integrationcredential_integration_id"),
        "integrationcredential",
        ["integration_id"],
        unique=False,
    )

    # Create IntegrationShare table
    op.create_table(
        "integrationshare",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "share_level",
            sa.Enum("full_access", "limited_access", "read_only", name="sharelevel"),
            nullable=False,
            default="read_only",
        ),
        sa.Column("status", sa.String(50), nullable=False, default="active"),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shared_by_user_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"],
            ["integration.id"],
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integrationshare_integration_id"),
        "integrationshare",
        ["integration_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_integrationshare_team_id"),
        "integrationshare",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        "ix_integrationshare_integration_id_team_id",
        "integrationshare",
        ["integration_id", "team_id"],
        unique=True,
    )

    # Create ServiceResource table
    op.create_table(
        "serviceresource",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resource_type", resource_type, nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"],
            ["integration.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_serviceresource_integration_id"),
        "serviceresource",
        ["integration_id"],
        unique=False,
    )
    op.create_index(
        "ix_serviceresource_integration_id_resource_type_external_id",
        "serviceresource",
        ["integration_id", "resource_type", "external_id"],
        unique=True,
    )

    # Create ResourceAccess table
    op.create_table(
        "resourceaccess",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("access_level", access_level, nullable=False, default="read"),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("granted_by_user_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"],
            ["serviceresource.id"],
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_resourceaccess_resource_id"),
        "resourceaccess",
        ["resource_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceaccess_team_id"), "resourceaccess", ["team_id"], unique=False
    )
    op.create_index(
        "ix_resourceaccess_resource_id_team_id",
        "resourceaccess",
        ["resource_id", "team_id"],
        unique=True,
    )

    # Create IntegrationEvent table
    op.create_table(
        "integrationevent",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", sa.String(255), nullable=False),
        sa.Column("affected_team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"],
            ["integration.id"],
        ),
        sa.ForeignKeyConstraint(
            ["affected_team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integrationevent_integration_id"),
        "integrationevent",
        ["integration_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_integrationevent_affected_team_id"),
        "integrationevent",
        ["affected_team_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_integrationevent_affected_team_id", table_name="integrationevent")
    op.drop_index("ix_integrationevent_integration_id", table_name="integrationevent")
    op.drop_table("integrationevent")

    op.drop_index("ix_resourceaccess_resource_id_team_id", table_name="resourceaccess")
    op.drop_index("ix_resourceaccess_team_id", table_name="resourceaccess")
    op.drop_index("ix_resourceaccess_resource_id", table_name="resourceaccess")
    op.drop_table("resourceaccess")

    op.drop_index(
        "ix_serviceresource_integration_id_resource_type_external_id",
        table_name="serviceresource",
    )
    op.drop_index("ix_serviceresource_integration_id", table_name="serviceresource")
    op.drop_table("serviceresource")

    op.drop_index(
        "ix_integrationshare_integration_id_team_id", table_name="integrationshare"
    )
    op.drop_index("ix_integrationshare_team_id", table_name="integrationshare")
    op.drop_index("ix_integrationshare_integration_id", table_name="integrationshare")
    op.drop_table("integrationshare")

    op.drop_index(
        "ix_integrationcredential_integration_id", table_name="integrationcredential"
    )
    op.drop_table("integrationcredential")

    op.drop_index("ix_integration_owner_team_id", table_name="integration")
    op.drop_table("integration")

    # Drop enums
    sa.Enum(name="eventtype").drop(op.get_bind())
    sa.Enum(name="accesslevel").drop(op.get_bind())
    sa.Enum(name="resourcetype").drop(op.get_bind())
    sa.Enum(name="sharelevel").drop(op.get_bind())
    sa.Enum(name="credentialtype").drop(op.get_bind())
    sa.Enum(name="integrationstatus").drop(op.get_bind())
    sa.Enum(name="integrationtype").drop(op.get_bind())
