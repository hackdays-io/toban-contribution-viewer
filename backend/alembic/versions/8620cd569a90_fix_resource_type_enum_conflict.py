"""fix_resource_type_enum_conflict

Revision ID: 8620cd569a90
Revises: 69208caae8cb
Create Date: 2025-04-24 09:39:54.388944

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '8620cd569a90'
down_revision = '69208caae8cb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### Create a modified version of cross resource report tables with different enum name ###
    op.create_table(
        "crossresourcereport",
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", name="reportstatus"
            ),
            nullable=False,
        ),
        sa.Column("date_range_start", sa.DateTime(), nullable=False),
        sa.Column("date_range_end", sa.DateTime(), nullable=False),
        sa.Column(
            "report_parameters", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("comprehensive_analysis", sa.Text(), nullable=True),
        sa.Column("comprehensive_analysis_generated_at", sa.DateTime(), nullable=True),
        sa.Column("model_used", sa.String(length=100), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cross_resource_report_team_id_status",
        "crossresourcereport",
        ["team_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crossresourcereport_id"), "crossresourcereport", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_crossresourcereport_status"),
        "crossresourcereport",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crossresourcereport_team_id"),
        "crossresourcereport",
        ["team_id"],
        unique=False,
    )
    op.create_table(
        "resourceanalysis",
        sa.Column("cross_resource_report_id", sa.UUID(), nullable=False),
        sa.Column("integration_id", sa.UUID(), nullable=False),
        sa.Column("resource_id", sa.UUID(), nullable=False),
        sa.Column(
            "resource_type",
            sa.Enum("SLACK_CHANNEL", "GITHUB_REPO", "NOTION_PAGE", name="analysisresourcetype"),
            nullable=False,
        ),
        sa.Column(
            "analysis_type",
            sa.Enum(
                "CONTRIBUTION", "TOPICS", "SENTIMENT", "ACTIVITY", name="analysistype"
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", name="reportstatus"
            ),
            nullable=False,
        ),
        sa.Column(
            "analysis_parameters",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("results", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("contributor_insights", sa.Text(), nullable=True),
        sa.Column("topic_analysis", sa.Text(), nullable=True),
        sa.Column("resource_summary", sa.Text(), nullable=True),
        sa.Column("key_highlights", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(length=100), nullable=True),
        sa.Column("analysis_generated_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["cross_resource_report_id"],
            ["crossresourcereport.id"],
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"],
            ["integration.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_resource_analysis_report_id_status",
        "resourceanalysis",
        ["cross_resource_report_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_resource_analysis_resource_type",
        "resourceanalysis",
        ["resource_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceanalysis_analysis_type"),
        "resourceanalysis",
        ["analysis_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceanalysis_cross_resource_report_id"),
        "resourceanalysis",
        ["cross_resource_report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceanalysis_id"), "resourceanalysis", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_resourceanalysis_integration_id"),
        "resourceanalysis",
        ["integration_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceanalysis_resource_type"),
        "resourceanalysis",
        ["resource_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resourceanalysis_status"), "resourceanalysis", ["status"], unique=False
    )


def downgrade() -> None:
    # Drop all indexes and tables created in the upgrade
    op.drop_index(op.f("ix_resourceanalysis_status"), table_name="resourceanalysis")
    op.drop_index(
        op.f("ix_resourceanalysis_resource_type"), table_name="resourceanalysis"
    )
    op.drop_index(
        op.f("ix_resourceanalysis_integration_id"), table_name="resourceanalysis"
    )
    op.drop_index(op.f("ix_resourceanalysis_id"), table_name="resourceanalysis")
    op.drop_index(
        op.f("ix_resourceanalysis_cross_resource_report_id"),
        table_name="resourceanalysis",
    )
    op.drop_index(
        op.f("ix_resourceanalysis_analysis_type"), table_name="resourceanalysis"
    )
    op.drop_index("ix_resource_analysis_resource_type", table_name="resourceanalysis")
    op.drop_index(
        "ix_resource_analysis_report_id_status", table_name="resourceanalysis"
    )
    op.drop_table("resourceanalysis")
    op.drop_index(
        op.f("ix_crossresourcereport_team_id"), table_name="crossresourcereport"
    )
    op.drop_index(
        op.f("ix_crossresourcereport_status"), table_name="crossresourcereport"
    )
    op.drop_index(op.f("ix_crossresourcereport_id"), table_name="crossresourcereport")
    op.drop_index(
        "ix_cross_resource_report_team_id_status", table_name="crossresourcereport"
    )
    op.drop_table("crossresourcereport")
