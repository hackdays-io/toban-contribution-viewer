"""fix_slackchannelanalysis_table

Revision ID: 48a0524f84c5
Revises: 9b8d4568d5be
Create Date: 2025-04-13 09:53:49.975143

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "48a0524f84c5"
down_revision = "9b8d4568d5be"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First drop the table if it exists
    try:
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
    except:
        # Table might not exist, which is fine
        pass

    # Create the table again with the missing is_active column
    op.create_table(
        "slackchannelanalysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.Column("raw_response", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    # Recreate the indexes
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


def downgrade() -> None:
    # No need to downgrade, as we're fixing a broken table
    pass
