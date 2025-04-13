"""add_channel_analysis_model

Revision ID: 9b8d4568d5be
Revises: 7d5c89f714c7
Create Date: 2025-04-13 18:18:08.510916

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "9b8d4568d5be"
down_revision = "7d5c89f714c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create a new table for storing LLM channel analysis results
    op.create_table(
        "slackchannelanalysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("slackanalysis.id"),
            nullable=False,
        ),
        sa.Column(
            "channel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("slackchannel.id"),
            nullable=False,
        ),
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=False),
        sa.Column("participant_count", sa.Integer(), nullable=False),
        sa.Column("thread_count", sa.Integer(), nullable=False),
        sa.Column("reaction_count", sa.Integer(), nullable=False),
        sa.Column("channel_summary", sa.Text(), nullable=True),
        sa.Column("topic_analysis", sa.Text(), nullable=True),
        sa.Column("contributor_insights", sa.Text(), nullable=True),
        sa.Column("key_highlights", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(255), nullable=True),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "raw_response", postgresql.JSONB(), nullable=True
        ),  # Store the full LLM response
        sa.Column("status", sa.String(50), nullable=False, default="completed"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    # Add indexes for efficient querying
    op.create_index(
        "ix_slackchannelanalysis_analysis_id",
        "slackchannelanalysis",
        ["analysis_id"],
    )
    op.create_index(
        "ix_slackchannelanalysis_channel_id",
        "slackchannelanalysis",
        ["channel_id"],
    )
    op.create_index(
        "ix_slackchannelanalysis_generated_at",
        "slackchannelanalysis",
        ["generated_at"],
    )
    op.create_index(
        "ix_slackchannelanalysis_analysis_id_channel_id",
        "slackchannelanalysis",
        ["analysis_id", "channel_id"],
        unique=True,
    )

    # Add new columns to SlackAnalysis table for better tracking
    op.add_column(
        "slackanalysis",
        sa.Column("llm_model", sa.String(255), nullable=True),
    )
    op.add_column(
        "slackanalysis",
        sa.Column("is_scheduled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "slackanalysis",
        sa.Column("schedule_frequency", sa.String(50), nullable=True),
    )
    op.add_column(
        "slackanalysis",
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "slackanalysis",
        sa.Column(
            "analysis_type",
            sa.String(50),
            nullable=False,
            server_default="channel_analysis",
        ),
    )


def downgrade() -> None:
    # Drop the new table
    op.drop_index(
        "ix_slackchannelanalysis_analysis_id_channel_id",
        table_name="slackchannelanalysis",
    )
    op.drop_index(
        "ix_slackchannelanalysis_generated_at", table_name="slackchannelanalysis"
    )
    op.drop_index(
        "ix_slackchannelanalysis_channel_id", table_name="slackchannelanalysis"
    )
    op.drop_index(
        "ix_slackchannelanalysis_analysis_id", table_name="slackchannelanalysis"
    )
    op.drop_table("slackchannelanalysis")

    # Drop the new columns from SlackAnalysis
    op.drop_column("slackanalysis", "llm_model")
    op.drop_column("slackanalysis", "is_scheduled")
    op.drop_column("slackanalysis", "schedule_frequency")
    op.drop_column("slackanalysis", "next_run_at")
    op.drop_column("slackanalysis", "analysis_type")
