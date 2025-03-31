#!/usr/bin/env node
import 'source-map-support/register';
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { DatabaseStack } from '../lib/database-stack';

// Load environment variables
dotenv.config();

const app = new cdk.App();

// Define environment
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create stacks
const databaseStack = new DatabaseStack(app, 'TobanDatabase', {
  env,
  description: 'Database resources for Toban Contribution Viewer',
});

const backendStack = new BackendStack(app, 'TobanBackend', {
  env,
  description: 'Backend resources for Toban Contribution Viewer',
  databaseSecretArn: databaseStack.databaseSecretArn,
  databaseInstance: databaseStack.databaseInstance,
  vpc: databaseStack.vpc,
  dbSecurityGroup: databaseStack.dbSecurityGroup,
});

const frontendStack = new FrontendStack(app, 'TobanFrontend', {
  env,
  description: 'Frontend resources for Toban Contribution Viewer',
  apiUrl: backendStack.apiUrl,
});

// Add dependencies - only frontend depends on backend
frontendStack.addDependency(backendStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'TobanContributionViewer');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'dev');