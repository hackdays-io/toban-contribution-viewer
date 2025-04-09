# Slack OAuth Integration Setup Guide

This guide explains how to set up and test the Slack OAuth integration in the Toban Contribution Viewer.

## Prerequisites

1. A Slack account with permission to create apps
2. A Slack workspace for testing

## Setting Up Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and sign in with your Slack account
2. Click "Create New App" and choose "From scratch"
3. Provide an app name (e.g., "Toban Contribution Viewer") and select your development workspace
4. In the "OAuth & Permissions" section, add the following scopes:
   - `channels:history`
   - `channels:read`
   - `groups:history`
   - `groups:read`
   - `reactions:read`
   - `users:read`
   - `users.profile:read`
   - `team:read`
5. In the "Redirect URLs" section, add the following URLs:
   - For local development with backend only: `http://localhost:8000/api/v1/slack/oauth-callback`
   - For local development with frontend: `http://localhost:5173/api/v1/slack/oauth-callback`
   - For production: `https://yourdomain.com/api/v1/slack/oauth-callback`
   
   **Important**: You must add all the URLs you plan to use. Slack requires an exact match between the redirect_uri in the OAuth request and the configured URLs.
6. Save your changes

## Configuring Environment Variables

Add the following variables to your environment:

```
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
```

### Development Environment

For local development, add these to:
1. `.env` file in the backend directory
2. `.env.docker` file in the root directory (for Docker development)

### Production Environment

In production, set these as environment variables in your deployment platform.

## Testing the Integration

1. Start the backend and frontend servers
2. Log in to the application
3. Navigate to the Slack connection page (`/dashboard/slack/connect`)
4. Click "Connect to Slack"
5. You should be redirected to Slack authorization page
6. Authorize the app
7. You should be redirected back to the application and see a success message

## Troubleshooting

### Environment Variables Not Set

If you encounter errors like "SLACK_CLIENT_ID is not configured", check:
1. Your environment variables are properly set
2. When using Docker, ensure `.env.docker` has the correct values
3. Restart your application after setting environment variables

### CORS Errors

If you see CORS errors, ensure:
1. The backend ALLOWED_HOSTS includes your frontend URL with port
2. The API_URL in frontend is correctly pointing to the backend

### OAuth Callback Issues

If authorization doesn't work properly:

1. **"redirect_uri did not match any configured URIs" error**:
   - This means the redirect URI sent to Slack doesn't match any configured in your Slack app settings
   - Go to your Slack app's settings at api.slack.com/apps
   - Navigate to "OAuth & Permissions" and check the "Redirect URLs" section
   - Make sure the exact URL being used in the request is listed there
   - For local development with frontend, add: `http://localhost:5173/api/v1/slack/oauth-callback`

2. **Other OAuth issues**:
   - Check that all Redirect URLs in your Slack app configuration match your callback routes
   - Ensure the callback endpoint is accessible from the internet if testing from Slack
   - Verify that the protocol (http/https) matches exactly
   - Check backend logs for detailed error messages

## Code Implementation

See these files for implementation details:
1. Backend: `/app/api/v1/slack/oauth.py` - OAuth endpoints
2. Frontend: `/frontend/src/components/slack/ConnectWorkspace.tsx` - UI for initiating OAuth

## Security Considerations

1. Never commit your Slack credentials to version control
2. Use environment variables for secrets
3. In production, ensure all traffic is over HTTPS
4. Consider implementing additional security measures like state parameter validation