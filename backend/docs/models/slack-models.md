# Slack Models Documentation

This document describes the database models used for the Slack integration in the Toban Contribution Viewer.

## Model Overview

The Slack integration uses the following database models:

1. **SlackWorkspace**: Represents a connected Slack workspace.
2. **SlackChannel**: Represents a channel within a workspace.
3. **SlackUser**: Represents a user within a workspace.
4. **SlackMessage**: Represents a message sent in a channel.
5. **SlackReaction**: Represents a reaction (emoji) to a message.
6. **SlackAnalysis**: Represents a contribution analysis for a time period.
7. **SlackContribution**: Represents a user's contribution metrics from an analysis.

## Model Relationships

![Slack Models Diagram](../diagrams/slack-models.png)

### Key Relationships:

- A **Workspace** has many **Channels** and **Users**
- A **Channel** belongs to a **Workspace** and contains many **Messages**
- A **User** belongs to a **Workspace** and has many **Messages** and **Reactions**
- A **Message** belongs to a **Channel** and a **User**, may have a parent **Message** (for threads), and can have many **Reactions**
- A **Reaction** belongs to a **Message** and a **User**
- An **Analysis** belongs to a **Workspace**, includes many **Channels**, and has many **Contributions**
- A **Contribution** belongs to an **Analysis**, a **User**, and optionally a **Channel**

## Model Details

### SlackWorkspace

Represents a connected Slack workspace.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| slack_id | String | Workspace ID from Slack API |
| name | String | Workspace name |
| domain | String | Workspace domain |
| icon_url | String | URL to workspace icon |
| team_size | Integer | Number of users in workspace |
| metadata | JSONB | Additional workspace metadata |
| is_connected | Boolean | Whether the workspace is currently connected |
| connection_status | String | Status of connection (active, disconnected, error) |
| last_connected_at | DateTime | When the workspace was last connected |
| last_sync_at | DateTime | When data was last synced from the workspace |
| access_token | String | OAuth access token (encrypted) |
| refresh_token | String | OAuth refresh token (encrypted) |
| token_expires_at | DateTime | When the access token expires |

### SlackChannel

Represents a channel within a Slack workspace.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | Reference to SlackWorkspace |
| slack_id | String | Channel ID from Slack API |
| name | String | Channel name |
| type | String | Channel type (public, private, im, mpim) |
| purpose | String | Channel purpose |
| topic | String | Channel topic |
| member_count | Integer | Number of members in channel |
| is_archived | Boolean | Whether the channel is archived |
| created_at_ts | String | Channel creation timestamp from Slack |
| is_bot_member | Boolean | Whether our bot is a member of the channel |
| bot_joined_at | DateTime | When our bot joined the channel |
| is_selected_for_analysis | Boolean | Whether the channel is selected for analysis |
| is_supported | Boolean | Whether the channel type is supported for analysis |
| last_sync_at | DateTime | When data was last synced from the channel |
| oldest_synced_ts | String | Oldest message timestamp synced |
| latest_synced_ts | String | Latest message timestamp synced |

### SlackUser

Represents a user within a Slack workspace.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | Reference to SlackWorkspace |
| slack_id | String | User ID from Slack API |
| name | String | Username |
| display_name | String | Display name |
| real_name | String | User's real name |
| email | String | User's email (if available) |
| title | String | User's job title |
| phone | String | User's phone number (if available) |
| timezone | String | User's timezone name |
| timezone_offset | Integer | User's timezone offset in seconds |
| profile_image_url | String | URL to profile image |
| is_bot | Boolean | Whether the user is a bot |
| is_admin | Boolean | Whether the user is an admin |
| is_deleted | Boolean | Whether the user account has been deleted |
| profile_data | JSONB | Additional profile data |

### SlackMessage

Represents a message sent in a Slack channel.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| channel_id | UUID | Reference to SlackChannel |
| user_id | UUID | Reference to SlackUser |
| parent_id | UUID | Reference to parent SlackMessage (for thread replies) |
| slack_id | String | Message ID from Slack API |
| slack_ts | String | Message timestamp from Slack API |
| text | Text | Raw message text |
| processed_text | Text | Processed message text (resolved mentions) |
| message_type | String | Message type (message, bot_message, etc.) |
| subtype | String | Message subtype from Slack API |
| is_edited | Boolean | Whether the message has been edited |
| edited_ts | String | Timestamp of last edit |
| has_attachments | Boolean | Whether the message has attachments |
| attachments | JSONB | Message attachments data |
| files | JSONB | File attachments data |
| thread_ts | String | Thread timestamp if in a thread |
| is_thread_parent | Boolean | Whether this is a thread parent message |
| is_thread_reply | Boolean | Whether this is a thread reply message |
| reply_count | Integer | Number of replies in thread |
| reply_users_count | Integer | Number of users in thread |
| reaction_count | Integer | Number of reactions to message |
| message_datetime | DateTime | Message timestamp as DateTime |
| is_analyzed | Boolean | Whether the message has been analyzed |
| message_category | String | Category from analysis (question, answer, etc.) |
| sentiment_score | Float | Sentiment score from analysis |
| analysis_data | JSONB | Additional analysis data |

### SlackReaction

Represents a reaction (emoji) to a Slack message.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| message_id | UUID | Reference to SlackMessage |
| user_id | UUID | Reference to SlackUser |
| emoji_name | String | Emoji name |
| emoji_code | String | Emoji code |
| reaction_ts | String | Timestamp when reaction was added |

### SlackAnalysis

Represents a contribution analysis for a time period.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | Reference to SlackWorkspace |
| created_by_user_id | UUID | User who created the analysis |
| name | String | Analysis name |
| description | Text | Analysis description |
| start_date | DateTime | Start date for analysis period |
| end_date | DateTime | End date for analysis period |
| parameters | JSONB | Analysis configuration parameters |
| status | String | Analysis status (pending, processing, completed, error) |
| progress | Float | Analysis completion percentage |
| error_message | Text | Error message if failed |
| result_summary | JSONB | Summary of analysis results |
| completion_time | DateTime | When analysis completed |

### SlackContribution

Represents a user's contribution metrics from an analysis.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| analysis_id | UUID | Reference to SlackAnalysis |
| user_id | UUID | Reference to SlackUser |
| channel_id | UUID | Reference to SlackChannel (optional) |
| problem_solving_score | Float | Score for problem-solving contributions |
| knowledge_sharing_score | Float | Score for knowledge sharing |
| team_coordination_score | Float | Score for team coordination |
| engagement_score | Float | Score for engagement |
| total_score | Float | Overall contribution score |
| message_count | Integer | Total messages by user |
| thread_reply_count | Integer | Total thread replies by user |
| reaction_given_count | Integer | Reactions given by user |
| reaction_received_count | Integer | Reactions received by user |
| notable_contributions | JSONB | List of notable contributions |
| insights | Text | Generated insights text |
| insights_data | JSONB | Structured insights data |

## Usage Examples

### Querying Workspace Data

```python
# Get all connected workspaces
connected_workspaces = db.query(SlackWorkspace).filter(
    SlackWorkspace.is_connected == True
).all()

# Get channels for a workspace
workspace = db.query(SlackWorkspace).filter(SlackWorkspace.slack_id == "T12345").first()
channels = workspace.channels
```

### Querying Messages

```python
# Get recent messages in a channel
messages = db.query(SlackMessage).filter(
    SlackMessage.channel_id == channel_id,
    SlackMessage.message_datetime >= start_date,
    SlackMessage.message_datetime <= end_date
).order_by(SlackMessage.message_datetime.desc()).limit(100).all()

# Get thread replies
parent_message = db.query(SlackMessage).filter(
    SlackMessage.slack_id == message_id
).first()
replies = parent_message.replies
```

### Working with Analysis

```python
# Create a new analysis
analysis = SlackAnalysis(
    workspace_id=workspace_id,
    name="Q1 2025 Analysis",
    start_date=datetime(2025, 1, 1),
    end_date=datetime(2025, 3, 31),
    parameters={"focus_areas": ["problem_solving", "knowledge_sharing"]}
)
db.add(analysis)
db.commit()

# Add channels to analysis
for channel_id in selected_channel_ids:
    channel = db.query(SlackChannel).get(channel_id)
    analysis.channels.append(channel)
db.commit()
```

## Data Synchronization

Data is synchronized from Slack through the following process:

1. Initial workspace connection stores basic workspace data
2. Channel synchronization retrieves available channels
3. User synchronization retrieves workspace members
4. Message synchronization retrieves messages per channel
5. Reaction synchronization retrieves reactions per message

Subsequent syncs use incremental updates based on timestamps to minimize API calls.
