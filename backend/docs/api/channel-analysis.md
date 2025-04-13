# Slack Channel Analysis API

This document describes the API endpoints for LLM-powered Slack channel analysis.

## Overview

The channel analysis API provides endpoints for analyzing Slack conversation data using large language models. These endpoints help extract valuable insights about communication patterns, key contributors, and discussion topics.

## Endpoints

### Analyze Channel

Analyzes messages in a Slack channel using an LLM to provide insights.

**URL**: `/api/v1/slack/workspaces/{workspace_id}/channels/{channel_id}/analyze`

**Method**: `POST`

**Auth required**: Yes

**Permissions required**: Access to the specified workspace and channel

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace_id` | string | Yes | ID of the workspace |
| `channel_id` | string | Yes | ID of the channel to analyze |
| `start_date` | ISO8601 date | No | Start date for analysis period (defaults to 30 days ago) |
| `end_date` | ISO8601 date | No | End date for analysis period (defaults to current date) |
| `include_threads` | boolean | No | Whether to include thread replies (default: true) |
| `include_reactions` | boolean | No | Whether to include reactions data (default: true) |
| `model` | string | No | Specific LLM model to use (see OpenRouter docs) |

**Example Request**:

```http
POST /api/v1/slack/workspaces/W012A3CDE/channels/C012AB3CD/analyze HTTP/1.1
Content-Type: application/json

{
  "start_date": "2023-03-01T00:00:00Z",
  "end_date": "2023-03-31T23:59:59Z",
  "include_threads": true,
  "include_reactions": true,
  "model": "anthropic/claude-3-sonnet:20240229"
}
```

**Success Response**:

```json
{
  "analysis_id": "analysis_C012AB3CD_1681234567",
  "channel_id": "C012AB3CD",
  "channel_name": "general",
  "period": {
    "start": "2023-03-01T00:00:00Z",
    "end": "2023-03-31T23:59:59Z"
  },
  "stats": {
    "message_count": 1254,
    "participant_count": 15,
    "thread_count": 42,
    "reaction_count": 378
  },
  "channel_summary": "This channel serves as the primary communication hub for the team...",
  "topic_analysis": "1. Project Updates: Team members regularly share progress on the redesign project...",
  "contributor_insights": "1. Alex (@alex) stands out as a key knowledge sharer...",
  "key_highlights": "1. The discussion on March 15th about the new API design...",
  "model_used": "anthropic/claude-3-sonnet:20240229",
  "generated_at": "2023-04-11T12:34:56Z"
}
```

**Error Responses**:

- **404 Not Found**: If the workspace or channel doesn't exist
  ```json
  { "detail": "Channel not found" }
  ```

- **500 Internal Server Error**: If an error occurs during analysis
  ```json
  { "detail": "Error analyzing channel: [error details]" }
  ```

## Analysis Content

The analysis response includes several sections:

1. **Channel Summary**: Overview of the channel's purpose, activity, and communication style
2. **Topic Analysis**: Identification of main discussion topics with examples
3. **Contributor Insights**: Highlights of key contributors and their contribution patterns
4. **Key Highlights**: Notable discussions, decisions, or interactions worth attention

## Performance Considerations

- For channels with large message volumes, the API implements intelligent sampling to fit within LLM token limits
- Analysis of very active channels may take longer to process
- Consider using date range parameters to limit the scope for faster results

## Caching

Analysis results may be cached to improve performance and reduce API costs. Cache invalidation occurs when:

- New messages are added to the analyzed time period
- Different analysis parameters are specified

## Rate Limiting

This endpoint may be subject to rate limiting due to underlying LLM API constraints. In case of rate limiting:

- The API will return a 429 status code
- Retry after the period specified in the `Retry-After` header

## Cost Considerations

LLM analysis incurs costs based on the model used and the volume of data processed. To optimize costs:

- Use selective date ranges rather than analyzing entire channel history
- Consider using more cost-effective models for routine analyses
- Limit analysis to essential channels

EOF < /dev/null
