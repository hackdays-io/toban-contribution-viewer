#!/bin/bash

# Script to acknowledge CDK notices
npx cdk acknowledge 32775

echo "CDK notices acknowledged. For actual bootstrapping, please follow the instructions in README.md"
echo "You will need to configure AWS credentials and run 'npx cdk bootstrap' manually."
