"""Prompt templates for LLM requests."""

# Template for channel analysis prompts
CHANNEL_ANALYSIS_PROMPT = """Analyze the following Slack conversation data for channel "{channel_name}" from {start_date} to {end_date}.

This analysis covers {message_count} messages from {participant_count} participants, including {thread_count} threads and {reaction_count} reactions.

CHANNEL MESSAGES:
{message_content}

Provide the following insights based on this data:

1. CHANNEL SUMMARY: In 2-3 paragraphs, describe the channel's main purpose, activity patterns, and overall communication style.

2. TOPIC ANALYSIS: Identify 3-5 main topics discussed during this period and briefly describe each. Include specific examples.

3. CONTRIBUTOR INSIGHTS: Highlight 3-5 key contributors and their unique contribution patterns (problem-solving, knowledge sharing, team coordination). Focus on quality over quantity of messages.

4. KEY HIGHLIGHTS: Identify 2-3 notable discussions, decisions, or interactions worth highlighting.

IMPORTANT: When referring to users in your response, preserve the original format exactly as it appears in the messages,
especially user mentions like <@U12345>. Do not translate these to plain names.

Be specific, reference actual messages when possible, and provide actionable insights.

Format your response with clear section headers for each of the four sections.
"""
