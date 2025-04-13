# OpenRouter Integration

This document describes the OpenRouter integration used for LLM-powered analytics in the Toban Contribution Viewer.

## Overview

OpenRouter is a unified API that provides access to various large language models (LLMs) including Claude, GPT-4, Mistral, Llama, and more. In our application, we use OpenRouter to analyze Slack conversation data and extract meaningful insights.

## Configuration

The following environment variables are used to configure the OpenRouter integration:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | (required) |
| `OPENROUTER_DEFAULT_MODEL` | Default LLM model to use | `anthropic/claude-3-opus:20240229` |
| `OPENROUTER_MAX_TOKENS` | Maximum tokens to generate | `4000` |
| `OPENROUTER_TEMPERATURE` | Temperature parameter (randomness) | `0.7` |

Add these variables to your `.env` file.

## Supported Models

OpenRouter provides access to many models. Here are some recommended options:

- `anthropic/claude-3-opus:20240229` - Highest quality, best for detailed analysis
- `anthropic/claude-3-sonnet:20240229` - Good balance of quality and cost
- `anthropic/claude-3-haiku:20240307` - Fastest, most economical
- `openai/gpt-4-turbo` - Alternative high-quality model
- `mistralai/mistral-large` - Open-source alternative

See the [OpenRouter documentation](https://openrouter.ai/docs) for a full list of available models.

## Usage

The OpenRouter integration is primarily used by the Slack channel analysis feature. The service handles:

1. Formatting conversation data for analysis
2. Constructing prompts with specific analysis tasks
3. Handling API communication with OpenRouter
4. Processing the LLM response into structured sections

## Implementation Details

The integration is implemented in `app/services/llm/openrouter.py` with the following components:

- `OpenRouterService` - Main class for interacting with the OpenRouter API
- `analyze_channel_messages()` - Method for sending channel data to an LLM and getting analysis

### Prompt Structure

The prompt sent to the LLM includes:

1. A system message defining the LLM's role as a communication analyst
2. A user message containing:
   - Channel information and date range
   - Statistics about message volume and participants
   - A sample of representative messages
   - Specific instructions for analysis tasks

### Response Processing

The LLM response is processed to extract the following sections:

- Channel summary
- Topic analysis
- Contributor insights
- Key highlights

## Costs and Usage Monitoring

Usage costs will vary depending on the selected model and the volume of data processed. To manage costs:

1. The integration implements intelligent message sampling for large channels
2. Response caching helps avoid redundant processing
3. Model selection allows choosing more economical models when appropriate

It's recommended to monitor your OpenRouter dashboard for usage statistics and costs.

## Rate Limits and Error Handling

The integration implements retry logic for handling temporary API failures and rate limits. Errors are logged to assist with troubleshooting.

## Adding New Analysis Types

To extend the integration with new analysis capabilities:

1. Update the prompt template in `OpenRouterService.analyze_channel_messages()`
2. Add new sections to extract in the `_extract_sections()` method
3. Update the API endpoint response model to include the new sections

EOF < /dev/null