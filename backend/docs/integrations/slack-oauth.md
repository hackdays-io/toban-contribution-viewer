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
   - For local development: `http://localhost:8000/api/v1/slack/oauth-callback`
   - For production: `https://yourdomain.com/api/v1/slack/oauth-callback`

   **Important**:
   - Slack requires an exact match between the redirect_uri in the OAuth request and the configured URLs
   - Our application always uses the backend URL for callbacks, even when the OAuth flow is initiated from the frontend
   - For non-localhost URLs, Slack REQUIRES HTTPS (http:// URLs will be rejected)
   - Only localhost URLs can use http:// protocol
6. Save your changes

## Configuring Environment Variables

Add the following variables to your environment:

```
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
API_URL=your_backend_url # e.g., http://localhost:8000 for local development
```

### Development Environment

For local development, add these to:
1. `.env` file in the backend directory
2. `.env.docker` file in the root directory (for Docker development)

### Production Environment

In production, set these as environment variables in your deployment platform.

## Testing the Integration

### Using ngrok for Local Development

Slack requires HTTPS URLs for OAuth redirects in production. To develop locally, use ngrok:

#### 1. Install and Configure ngrok
```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel to your backend
ngrok http 8000
```

#### 2. Configure Slack App with ngrok URL
- Copy the HTTPS URL from ngrok (e.g., `https://abc-123-xyz.ngrok-free.app`)
- In Slack app settings under "OAuth & Permissions", add:
  ```
  https://abc-123-xyz.ngrok-free.app/auth/slack/callback
  ```
  **IMPORTANT**: This URL must match the frontend callback route, not the API endpoint

#### 3. Configure Environment Variables
Update your `.env.docker` file with:
```bash
# Slack credentials
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# ngrok URL for callbacks
NGROK_URL=https://abc-123-xyz.ngrok-free.app
```

#### 4. Apply Changes
```bash
# Restart the backend container
docker compose restart backend
```

#### 5. Verify Configuration
You can check the redirect URI being used by looking at the backend logs:
```bash
docker compose logs backend | grep "Using redirect URI"
```

#### Troubleshooting ngrok
- The free version of ngrok generates a new URL each session
- Update both Slack app settings and `.env.docker` when restarting ngrok
- Consider upgrading to ngrok Pro for a fixed subdomain

### Testing the flow

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
   - Check the backend logs to see the exact URI being used:
     ```bash
     docker compose logs backend | grep "Using redirect URI"
     ```
   - Add the exact URI to your Slack app's "Redirect URLs" section
   - Common issues with ngrok:
     - ngrok URL has changed (free tier generates new URL each session)
     - Your NGROK_URL environment variable doesn't match the current ngrok URL
     - You forgot to restart the backend after updating the NGROK_URL

2. **"URL is not HTTPS" error**:
   - Slack requires HTTPS for all non-localhost URLs
   - Make sure you're using the HTTPS URL provided by ngrok, not HTTP
   - Verify the ngrok tunnel is running properly
   - If using a custom domain, ensure it has a valid SSL certificate
   - Make sure your ngrok URL is properly configured in both your application and Slack app settings

3. **Other OAuth issues**:
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
