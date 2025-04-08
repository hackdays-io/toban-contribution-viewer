"""Create Slack models

Revision ID: 001
Revises: 
Create Date: 2025-04-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create SlackWorkspace table
    op.create_table(
        'slackworkspace',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('slack_id', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('icon_url', sa.String(1024), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('connection_status', sa.String(50), nullable=False, server_default=sa.text("'active'")),
        sa.Column('last_connected_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('access_token', sa.String(1024), nullable=True),
        sa.Column('refresh_token', sa.String(1024), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_slackworkspace_slack_id', 'slackworkspace', ['slack_id'], unique=True)
    
    # Create SlackChannel table
    op.create_table(
        'slackchannel',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('slack_id', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('purpose', sa.String(1024), nullable=True),
        sa.Column('topic', sa.String(1024), nullable=True),
        sa.Column('member_count', sa.Integer(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at_ts', sa.String(50), nullable=True),
        sa.Column('is_bot_member', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('bot_joined_at', sa.DateTime(), nullable=True),
        sa.Column('is_selected_for_analysis', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_supported', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('oldest_synced_ts', sa.String(50), nullable=True),
        sa.Column('latest_synced_ts', sa.String(50), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['slackworkspace.id']),
    )
    op.create_index('ix_slackchannel_slack_id', 'slackchannel', ['slack_id'])
    op.create_index('ix_slackchannel_workspace_id_slack_id', 'slackchannel', ['workspace_id', 'slack_id'], unique=True)
    
    # Create SlackUser table
    op.create_table(
        'slackuser',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('slack_id', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('real_name', sa.String(255), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('timezone', sa.String(100), nullable=True),
        sa.Column('timezone_offset', sa.Integer(), nullable=True),
        sa.Column('profile_image_url', sa.String(1024), nullable=True),
        sa.Column('is_bot', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('profile_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['slackworkspace.id']),
    )
    op.create_index('ix_slackuser_slack_id', 'slackuser', ['slack_id'])
    op.create_index('ix_slackuser_workspace_id_slack_id', 'slackuser', ['workspace_id', 'slack_id'], unique=True)
    
    # Create SlackMessage table
    op.create_table(
        'slackmessage',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('slack_id', sa.String(255), nullable=False),
        sa.Column('slack_ts', sa.String(50), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('processed_text', sa.Text(), nullable=True),
        sa.Column('message_type', sa.String(50), nullable=False, server_default=sa.text("'message'")),
        sa.Column('subtype', sa.String(50), nullable=True),
        sa.Column('is_edited', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('edited_ts', sa.String(50), nullable=True),
        sa.Column('has_attachments', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('attachments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('files', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('thread_ts', sa.String(50), nullable=True),
        sa.Column('is_thread_parent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_thread_reply', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('reply_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('reply_users_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('reaction_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('message_datetime', sa.DateTime(), nullable=False),
        sa.Column('is_analyzed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('message_category', sa.String(100), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('analysis_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['channel_id'], ['slackchannel.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['slackmessage.id']),
        sa.ForeignKeyConstraint(['user_id'], ['slackuser.id']),
    )
    op.create_index('ix_slackmessage_slack_id', 'slackmessage', ['slack_id'])
    op.create_index('ix_slackmessage_slack_ts', 'slackmessage', ['slack_ts'])
    op.create_index('ix_slackmessage_thread_ts', 'slackmessage', ['thread_ts'])
    op.create_index('ix_slackmessage_message_datetime', 'slackmessage', ['message_datetime'])
    op.create_index('ix_slackmessage_channel_id_slack_ts', 'slackmessage', ['channel_id', 'slack_ts'])
    op.create_index('ix_slackmessage_user_id_slack_ts', 'slackmessage', ['user_id', 'slack_ts'])
    
    # Create SlackReaction table
    op.create_table(
        'slackreaction',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('emoji_name', sa.String(255), nullable=False),
        sa.Column('emoji_code', sa.String(255), nullable=True),
        sa.Column('reaction_ts', sa.String(50), nullable=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['slackmessage.id']),
        sa.ForeignKeyConstraint(['user_id'], ['slackuser.id']),
    )
    op.create_index('ix_slackreaction_message_id_user_id_emoji_name', 'slackreaction', ['message_id', 'user_id', 'emoji_name'], unique=True)
    
    # Create SlackAnalysis table
    op.create_table(
        'slackanalysis',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('parameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('progress', sa.Float(), nullable=False, server_default=sa.text('0')),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('result_summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('completion_time', sa.DateTime(), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['slackworkspace.id']),
    )
    
    # Create analysis_channels association table
    op.create_table(
        'analysis_channels',
        sa.Column('analysis_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['analysis_id'], ['slackanalysis.id']),
        sa.ForeignKeyConstraint(['channel_id'], ['slackchannel.id']),
        sa.PrimaryKeyConstraint('analysis_id', 'channel_id')
    )
    
    # Create SlackContribution table
    op.create_table(
        'slackcontribution',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('problem_solving_score', sa.Float(), nullable=True),
        sa.Column('knowledge_sharing_score', sa.Float(), nullable=True),
        sa.Column('team_coordination_score', sa.Float(), nullable=True),
        sa.Column('engagement_score', sa.Float(), nullable=True),
        sa.Column('total_score', sa.Float(), nullable=True),
        sa.Column('message_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('thread_reply_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('reaction_given_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('reaction_received_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('notable_contributions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('insights', sa.Text(), nullable=True),
        sa.Column('insights_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('analysis_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['analysis_id'], ['slackanalysis.id']),
        sa.ForeignKeyConstraint(['channel_id'], ['slackchannel.id']),
        sa.ForeignKeyConstraint(['user_id'], ['slackuser.id']),
    )
    op.create_index('ix_slackcontribution_analysis_id_user_id_channel_id', 'slackcontribution', ['analysis_id', 'user_id', 'channel_id'], unique=True)
    
    # Add uuid-ossp extension if not exists (for UUID generation)
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table('slackcontribution')
    op.drop_table('analysis_channels')
    op.drop_table('slackanalysis')
    op.drop_table('slackreaction')
    op.drop_table('slackmessage')
    op.drop_table('slackuser')
    op.drop_table('slackchannel')
    op.drop_table('slackworkspace')