# Deployment Guide

This document provides detailed instructions for setting up and configuring the deployment pipeline for the Toban Contribution Viewer project.

## Infrastructure Setup with CDK

Our infrastructure is defined using AWS CDK (Cloud Development Kit) in TypeScript. The CDK code is located in the `infrastructure/cdk` directory and consists of three main stacks:

1. **DatabaseStack**: Sets up RDS PostgreSQL instance with proper security groups and secrets
2. **BackendStack**: Configures Elastic Beanstalk for the Python backend
3. **FrontendStack**: Creates S3 bucket and CloudFront distribution for the React frontend

### Deploying Infrastructure

You can deploy the infrastructure manually with these steps:

```bash
# Navigate to the CDK directory
cd infrastructure/cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy all stacks
npm run deploy
```

Alternatively, the infrastructure is automatically deployed through GitHub Actions when changes are pushed to the `main` branch (see the CI/CD Pipeline section below).

### Manual Setup (Alternative to CDK)

If you prefer to set up the resources manually instead of using CDK, follow these steps:

#### Backend: AWS Elastic Beanstalk

1. **Create an Elastic Beanstalk Application:**
   ```bash
   aws elasticbeanstalk create-application --application-name toban-contribution-viewer
   ```

2. **Create an Elastic Beanstalk Environment:**
   ```bash
   aws elasticbeanstalk create-environment \
     --application-name toban-contribution-viewer \
     --environment-name toban-contribution-viewer-prod \
     --solution-stack-name "64bit Amazon Linux 2023 v4.5.0 running Python 3.9" \
     --option-settings file://backend/eb-config.json
   ```

3. **Configure Environment Variables:**
   Set the following environment variables in the Elastic Beanstalk environment:
   - `DATABASE_URL`: Your production PostgreSQL connection string
   - `SECRET_KEY`: A secure random string for production
   - `AUTH0_DOMAIN`: Your Auth0 domain
   - `AUTH0_CLIENT_ID`: Your Auth0 client ID
   - `AUTH0_CLIENT_SECRET`: Your Auth0 client secret
   - `AUTH0_AUDIENCE`: Your Auth0 API audience
   - `OPENAI_API_KEY`: Your OpenAI API key

4. **Set Up Database:**
   - Create an RDS PostgreSQL instance
   - Configure security groups to allow access from your Elastic Beanstalk environment
   - Create the initial database schema

#### Frontend: AWS S3 and CloudFront

1. **Create an S3 Bucket:**
   ```bash
   aws s3 mb s3://toban-contribution-viewer-frontend --region us-east-1
   ```

2. **Configure the S3 Bucket for Static Website Hosting:**
   ```bash
   aws s3 website s3://toban-contribution-viewer-frontend \
     --index-document index.html \
     --error-document index.html
   ```

3. **Set Bucket Policy for Public Access:**
   Create a file named `bucket-policy.json` with the following content:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::toban-contribution-viewer-frontend/*"
       }
     ]
   }
   ```
   Apply the policy:
   ```bash
   aws s3api put-bucket-policy \
     --bucket toban-contribution-viewer-frontend \
     --policy file://bucket-policy.json
   ```

4. **Create a CloudFront Distribution:**
   ```bash
   aws cloudfront create-distribution \
     --origin-domain-name toban-contribution-viewer-frontend.s3.amazonaws.com \
     --default-root-object index.html
   ```

5. **Configure Custom Domain (Optional):**
   - Create a certificate using AWS Certificate Manager
   - Add the domain to your CloudFront distribution
   - Configure DNS settings to point to your CloudFront distribution

## CI/CD Pipeline with GitHub Actions

Our CI/CD pipeline is implemented using GitHub Actions. The workflow files are located in the `.github/workflows` directory.

### Workflow Files

1. **infrastructure-deploy.yml**: Deploys AWS CDK infrastructure
2. **backend-deploy.yml**: Runs tests and deploys backend to Elastic Beanstalk
3. **frontend-deploy.yml**: Runs tests and deploys frontend to S3/CloudFront

### Creating Required Secrets

Add the following secrets to your GitHub repository:

1. AWS credentials:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: The AWS region (e.g., us-east-1)
   - `AWS_ACCOUNT_ID`: Your AWS account ID

2. Elastic Beanstalk configuration:
   - `EB_APPLICATION_NAME`: Your Elastic Beanstalk application name (e.g., TobanContributionViewer)
   - `EB_ENVIRONMENT_NAME`: Your Elastic Beanstalk environment name (e.g., TobanContributionViewer-prod)

3. S3 and CloudFront configuration:
   - `S3_BUCKET_NAME`: Your S3 bucket name (from the CDK output)
   - `CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID (from the CDK output)
   - `SITE_DOMAIN`: Your site domain (e.g., app.yoursite.com)
   - `API_DOMAIN`: Your API domain (from Elastic Beanstalk)

4. Environment-specific variables:
   - `FRONTEND_API_URL`: URL for the frontend to access the API
   - `AUTH0_DOMAIN`: Your Auth0 domain
   - `AUTH0_CLIENT_ID`: Your Auth0 client ID
   - `AUTH0_AUDIENCE`: Your Auth0 API audience

5. Slack notifications (optional):
   - `SLACK_WEBHOOK_URL`: Your Slack webhook URL for deployment notifications

### Testing the Deployment

1. Push a change to the main branch to trigger the deployment workflow
2. Monitor the GitHub Actions workflow run
3. Verify the deployment was successful by accessing your application

## Deployment Environments

### Production

The production environment is automatically deployed when changes are pushed to the main branch. You can also manually trigger a deployment through the GitHub Actions interface.

### Staging (Optional)

To set up a staging environment:

1. Create a new branch (e.g., `staging`)
2. Duplicate the workflow files and modify them to target staging environments
3. Configure the workflows to deploy to the staging environment when changes are pushed to the staging branch

## Rollback Procedures

### Infrastructure Rollback

1. Find the previous CloudFormation stack version in the AWS Console
2. Restore the previous version using CloudFormation
3. Alternatively, make changes to fix issues in the CDK code and redeploy

### Backend Rollback

1. Open the Elastic Beanstalk console
2. Navigate to your environment
3. Select the "Application versions" tab
4. Select the previous working version
5. Click "Deploy" to roll back to that version

### Frontend Rollback

1. Navigate to your S3 bucket
2. Restore a previous version using S3 versioning
3. Invalidate the CloudFront cache to serve the restored version

## Local Development Setup

See the README.md file for instructions on setting up the development environment locally.