#!/bin/bash

# This script helps with rollback when deployment fails

# Destroy specific stacks or use --all to destroy all stacks
echo "Rolling back CDK deployment..."
npx cdk destroy --all --force
