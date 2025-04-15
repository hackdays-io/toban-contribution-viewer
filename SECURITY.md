# Security Considerations for Toban Contribution Viewer

This document outlines important security considerations for the application, particularly related to CORS, database management, and environment-specific configurations.

## CORS Configuration

The application uses different CORS configurations based on the environment:

### Development Environment
- In development, the application uses a more permissive CORS configuration to allow for local development and ngrok tunneling.
- The frontend uses a proxy configuration to avoid CORS issues during development.
- Custom CORS middleware ensures proper handling of cross-origin requests.

### Production Environment
- In production, strict CORS rules apply, with only specific allowed origins.
- No wildcards are used for `allow_origins` in production when credentials are required.
- The API URL in production should be an absolute URL to the API server, not a relative path.

## Database Management

### Development Scripts
- Database setup and reset scripts are included for development purposes.
- These scripts include safeguards to prevent accidental execution in production.
- They require explicit confirmation if run in a production environment.

### Production Database
- **IMPORTANT**: Never run the database reset scripts in production without a proper backup.
- Production database changes should be managed through proper migrations.
- Ensure proper database credentials and access controls in production.

## Environment Variables

The application uses environment-specific configuration:

### Development
- Set `DEBUG=True` in development to enable helpful debugging features.
- Use `.env.docker` and `.env` files for local development.
- Set `ENVIRONMENT=development` to enable development-specific features.

### Production
- Set `DEBUG=False` in production.
- Ensure all secrets (JWT, API keys, etc.) are properly secured and not hardcoded.
- Set `ENVIRONMENT=production` to disable development-specific features.
- Configure proper values for `ALLOWED_HOSTS` with specific domains.

## API Access

- Implement proper authentication and authorization for all API endpoints.
- Use HTTPS in production.
- Limit exposed debugging endpoints in production.

## Regular Security Checks

- Regularly update dependencies to patch security vulnerabilities.
- Perform security audits of the codebase.
- Test for common vulnerabilities like XSS, CSRF, injection attacks, etc.

## Reporting Security Issues

If you discover a security vulnerability, please send an email to [security@example.com](mailto:security@example.com). Do not disclose security vulnerabilities publicly until they have been addressed by the team.