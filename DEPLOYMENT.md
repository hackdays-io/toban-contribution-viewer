# Deployment Guide

This document provides detailed instructions for setting up and configuring the deployment pipeline for the Toban Contribution Viewer project.

## Infrastructure Setup

### Backend: AWS Elastic Beanstalk

1. **Create an Elastic Beanstalk Application:**
   ```bash
   aws elasticbeanstalk create-application --application-name toban-contribution-viewer
   ```

2. **Create an Elastic Beanstalk Environment:**
   ```bash
   aws elasticbeanstalk create-environment \
     --application-name toban-contribution-viewer \
     --environment-name toban-contribution-viewer-prod \
     --solution-stack-name "64bit Amazon Linux 2023 v4.0.6 running Python 3.12" \
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

### Frontend: AWS S3 and CloudFront

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

## GitHub Actions Setup

### Creating Required Secrets

Add the following secrets to your GitHub repository:

1. AWS credentials:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: The AWS region (e.g., us-east-1)

2. Elastic Beanstalk configuration:
   - `EB_APPLICATION_NAME`: Your Elastic Beanstalk application name (e.g., toban-contribution-viewer)
   - `EB_ENVIRONMENT_NAME`: Your Elastic Beanstalk environment name (e.g., toban-contribution-viewer-prod)

3. S3 and CloudFront configuration:
   - `S3_BUCKET_NAME`: Your S3 bucket name (e.g., toban-contribution-viewer-frontend)
   - `CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID
   - `SITE_DOMAIN`: Your site domain (e.g., app.yoursite.com)

4. Environment-specific variables:
   - All the required backend and frontend environment variables for production

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

1. Create additional Elastic Beanstalk environment and S3 bucket for staging
2. Create a new GitHub workflow file specifically for staging deployment
3. Configure the workflow to deploy to the staging environment when changes are pushed to a staging branch

## Rollback Procedures

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