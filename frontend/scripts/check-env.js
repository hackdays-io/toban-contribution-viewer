#!/usr/bin/env node

/**
 * Environment variables validation script
 * Verifies that all required environment variables are present in the .env file
 * Can be run as a pre-build check in CI/CD pipelines
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Convert ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Required environment variables that must be defined
const REQUIRED_ENV_VARS = [
  'VITE_API_URL',
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_AUDIENCE',
];

// Function to parse .env file
function parseEnvFile(filePath) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(filePath));
    return envConfig;
  } catch (error) {
    console.error(`Error reading .env file: ${filePath}`);
    console.error(error);
    return {};
  }
}

// Main function to check environment variables
function checkEnv() {
  // Determine which environment file to check
  const envFile = process.argv[2] || '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  
  // Check if the environment file exists
  if (!fs.existsSync(envPath)) {
    console.error(`Environment file not found: ${envPath}`);
    process.exit(1);
  }
  
  console.log(`Checking environment variables in: ${envPath}`);
  
  // Parse the environment file
  const envVars = parseEnvFile(envPath);
  
  // Check for missing required variables
  const missingVars = REQUIRED_ENV_VARS.filter(varName => !envVars[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are present.');
}

// Run the check
checkEnv();
