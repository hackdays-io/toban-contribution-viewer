# Toban Contribution Viewer Infrastructure

This directory contains the AWS CDK infrastructure code for the Toban Contribution Viewer application.

## Prerequisites

- Node.js 18.x or later
- AWS CLI installed and configured
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment configuration:

```bash
cp .env.example .env
```

3. Edit `.env` with your AWS account ID and other settings.

## Bootstrapping AWS Environment

Before you can deploy CDK stacks, you need to bootstrap your AWS environment:

```bash
# For a single account
npx cdk bootstrap aws://123456789012/us-east-1

# For an entire AWS Organization using OU
npx cdk bootstrap aws:ou-xxxx-xxxxxxxx/us-east-1
```

**Important**: If you encounter a cyclic dependency error, the code has been modified to avoid this issue. Make sure you're using the latest version of the code.

## Deploying Infrastructure

To deploy all infrastructure stacks:

```bash
npm run deploy
```

To see the changes before deploying:

```bash
npm run diff
```

## Infrastructure Components

The infrastructure consists of the following stacks:

1. **Database Stack** - Creates an RDS PostgreSQL database
2. **Backend Stack** - Sets up Elastic Beanstalk for the Python backend
3. **Frontend Stack** - Creates S3 bucket and CloudFront distribution for the frontend

## CI/CD Integration

The stacks are designed to work with the CI/CD pipelines defined in the `.github/workflows` directory to enable automated deployments.

## Cleanup

To destroy all resources (use with caution):

```bash
npx cdk destroy --all
```
