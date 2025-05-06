#!/usr/bin/env node

/**
 * Fetch Slack Data
 * 
 * This script fetches data from the Slack API and saves it as JSON files
 * for use by the mock Slack API service in integration tests.
 */

const fs = require('fs');
const path = require('path');
const slackWebApi = require('@slack/web-api');
const { Command } = require('commander');
require('dotenv').config();

const WebClient = slackWebApi.WebClient;

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '../mocks/slack-api/data');
const DEFAULT_CHANNEL_LIMIT = 10;
const DEFAULT_MESSAGE_LIMIT = 20;
const DEFAULT_USER_LIMIT = 20;

const program = new Command();
program
  .version('1.0.0')
  .description('Fetch Slack data for test data generation')
  .option('-t, --token <token>', 'Slack API token (or set SLACK_TOKEN env var)')
  .option('-o, --output <directory>', 'Output directory for data files', DEFAULT_OUTPUT_DIR)
  .option('-c, --channels <number>', 'Number of channels to fetch', DEFAULT_CHANNEL_LIMIT)
  .option('-m, --messages <number>', 'Number of messages per channel', DEFAULT_MESSAGE_LIMIT)
  .option('-u, --users <number>', 'Number of users to fetch', DEFAULT_USER_LIMIT)
  .option('--client-id <id>', 'Slack app client ID for OAuth data')
  .option('--client-secret <secret>', 'Slack app client secret for OAuth data')
  .option('--no-sanitize', 'Disable sanitization of sensitive data');

program.parse(process.argv);
const options = program.opts();

const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`)
};

const token = options.token || process.env.SLACK_TOKEN;
if (!token) {
  log.error('Slack API token is required. Use --token option or set SLACK_TOKEN env var.');
  process.exit(1);
}

const outputDir = options.output;
fs.mkdirSync(outputDir, { recursive: true });

const channelLimit = parseInt(options.channels);
const messageLimit = parseInt(options.messages);
const userLimit = parseInt(options.users);
const shouldSanitize = options.sanitize !== false;

log.info(`Output directory: ${outputDir}`);
log.info(`Fetching up to ${channelLimit} channels, ${messageLimit} messages/channel, and ${userLimit} users`);
if (shouldSanitize) {
  log.info('Sanitization is enabled - sensitive data will be anonymized');
} else {
  log.warn('Sanitization is disabled - data will contain real information');
}

const slack = new WebClient(token);

/**
 * Sanitize sensitive data in objects
 */
function sanitizeData(data, type, messageUserIds = []) {
  if (!shouldSanitize) return data;
  
  if (type === 'users') {
    const originalMembers = data.members;
    let sanitizedMembers = [];
    
    if (messageUserIds.length > 0) {
      log.info(`Creating sanitized data for ${messageUserIds.length} message authors`);
      
      messageUserIds.forEach((userId, index) => {
        const existingUser = originalMembers.find(u => u.id === userId) || originalMembers[0];
        
        if (!existingUser) {
          log.warn(`No template user found for ID ${userId}`);
          return;
        }
        
        const sanitizedUser = { ...existingUser, id: userId };
        
        if (sanitizedUser.profile) {
          sanitizedUser.profile = { ...sanitizedUser.profile };
          sanitizedUser.profile.email = `user${index + 1}@example.com`;
          sanitizedUser.profile.real_name = `User ${index + 1}`;
          sanitizedUser.profile.real_name_normalized = `User ${index + 1}`;
          sanitizedUser.profile.display_name = `User ${index + 1}`;
          sanitizedUser.profile.display_name_normalized = `User ${index + 1}`;
          sanitizedUser.profile.phone = '';
          
          sanitizedUser.profile.image_original = `https://example.com/images/user${index + 1}.jpg`;
          sanitizedUser.profile.image_24 = `https://example.com/images/user${index + 1}_24.jpg`;
          sanitizedUser.profile.image_32 = `https://example.com/images/user${index + 1}_32.jpg`;
          sanitizedUser.profile.image_48 = `https://example.com/images/user${index + 1}_48.jpg`;
          sanitizedUser.profile.image_72 = `https://example.com/images/user${index + 1}_72.jpg`;
          sanitizedUser.profile.image_192 = `https://example.com/images/user${index + 1}_192.jpg`;
          sanitizedUser.profile.image_512 = `https://example.com/images/user${index + 1}_512.jpg`;
        }
        
        if (sanitizedUser.real_name) {
          sanitizedUser.real_name = `User ${index + 1}`;
        }
        
        sanitizedMembers.push(sanitizedUser);
      });
      
      log.success(`Created ${sanitizedMembers.length} sanitized user records`);
    } else {
      log.info('No message authors found, sanitizing all users');
      sanitizedMembers = originalMembers.map((user, index) => {
        const sanitizedUser = { ...user };
        
        if (sanitizedUser.profile) {
          sanitizedUser.profile = { ...sanitizedUser.profile };
          sanitizedUser.profile.email = `user${index + 1}@example.com`;
          sanitizedUser.profile.real_name = `User ${index + 1}`;
          sanitizedUser.profile.real_name_normalized = `User ${index + 1}`;
          sanitizedUser.profile.display_name = `User ${index + 1}`;
          sanitizedUser.profile.display_name_normalized = `User ${index + 1}`;
          sanitizedUser.profile.phone = '';
          
          sanitizedUser.profile.image_original = `https://example.com/images/user${index + 1}.jpg`;
          sanitizedUser.profile.image_24 = `https://example.com/images/user${index + 1}_24.jpg`;
          sanitizedUser.profile.image_32 = `https://example.com/images/user${index + 1}_32.jpg`;
          sanitizedUser.profile.image_48 = `https://example.com/images/user${index + 1}_48.jpg`;
          sanitizedUser.profile.image_72 = `https://example.com/images/user${index + 1}_72.jpg`;
          sanitizedUser.profile.image_192 = `https://example.com/images/user${index + 1}_192.jpg`;
          sanitizedUser.profile.image_512 = `https://example.com/images/user${index + 1}_512.jpg`;
        }
        
        if (sanitizedUser.real_name) {
          sanitizedUser.real_name = `User ${index + 1}`;
        }
        
        return sanitizedUser;
      });
    }
    
    return { ...data, members: sanitizedMembers };
  }
  
  if (type === 'oauth') {
    const sanitizedData = { ...data };
    
    if (sanitizedData.access_token) {
      sanitizedData.access_token = 'xoxb-test-token';
    }
    if (sanitizedData.authed_user && sanitizedData.authed_user.access_token) {
      sanitizedData.authed_user.access_token = 'xoxp-test-token';
    }
    
    return sanitizedData;
  }
  
  return data;
}

/**
 * Save data to a JSON file
 */
function saveToFile(data, filename) {
  const filePath = path.join(outputDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    log.success(`Saved data to ${filePath}`);
  } catch (error) {
    log.error(`Failed to save ${filename}: ${error.message}`);
  }
}

/**
 * Fetch users from Slack API
 */
async function fetchUsers(messageUserIds = []) {
  try {
    log.info('Fetching user list...');
    const result = await slack.users.list({ limit: userLimit });
    const sanitizedData = sanitizeData(result, 'users', messageUserIds);
    saveToFile(sanitizedData, 'users.json');
    return sanitizedData.members;
  } catch (error) {
    log.error(`Failed to fetch users: ${error.message}`);
    return [];
  }
}

/**
 * Fetch channels from Slack API
 */
async function fetchChannels() {
  try {
    log.info('Fetching channel list...');
    const result = await slack.conversations.list({
      limit: channelLimit,
      types: 'public_channel,private_channel'
    });
    saveToFile(result, 'conversations.json');
    return result.channels;
  } catch (error) {
    log.error(`Failed to fetch channels: ${error.message}`);
    return [];
  }
}

/**
 * Fetch message history for a channel
 */
async function fetchMessages(channel) {
  try {
    log.info(`Fetching messages for channel ${channel.name} (${channel.id})...`);
    const result = await slack.conversations.history({
      channel: channel.id,
      limit: messageLimit
    });
    saveToFile(result, `conversations_history_${channel.id}.json`);
    return result.messages;
  } catch (error) {
    log.error(`Failed to fetch messages for channel ${channel.id}: ${error.message}`);
    return [];
  }
}

/**
 * Create mock OAuth response
 */
function createOAuthResponse() {
  const oauthResponse = {
    ok: true,
    access_token: `xoxb-${Date.now()}`,
    token_type: "bot",
    scope: "channels:history,channels:read,users:read",
    bot_user_id: "B12345",
    app_id: "A12345",
    team: {
      id: "T12345",
      name: "Test Team",
      domain: "testteam"
    },
    enterprise: null,
    authed_user: {
      id: "U12345",
      scope: "chat:write",
      access_token: `xoxp-${Date.now()}`,
      token_type: "user"
    },
    is_enterprise_install: false
  };
  
  const sanitizedData = sanitizeData(oauthResponse, 'oauth');
  saveToFile(sanitizedData, 'oauth.json');
}

/**
 * Main execution function
 */
async function main() {
  try {
    log.info('Verifying Slack API token...');
    await slack.auth.test();
    
    const channels = await fetchChannels();
    
    const targetChannelIds = ['C02FMV4EZ', 'C08JP0V9VT8']; // 06_random and proj_oss_boardgame
    log.info(`Targeting specific channels: ${targetChannelIds.join(', ')}`);
    
    const targetChannels = channels.filter(channel => targetChannelIds.includes(channel.id));
    if (targetChannels.length === 0) {
      log.warn('Target channels not found. Please check channel IDs.');
      return;
    }
    
    const messageUserIds = new Set();
    const allMessages = [];
    
    for (const channel of targetChannels) {
      const messages = await fetchMessages(channel);
      if (messages && messages.length > 0) {
        messages.forEach(msg => {
          if (msg.user) messageUserIds.add(msg.user);
          if (msg.bot_id) messageUserIds.add(msg.bot_id);
        });
        allMessages.push(...messages);
      }
    }
    
    const userIdArray = Array.from(messageUserIds);
    log.info(`Found ${userIdArray.length} unique user IDs in messages`);
    const users = await fetchUsers(userIdArray);
    
    createOAuthResponse();
    
    log.success('Data fetching completed successfully!');
  } catch (error) {
    log.error(`Failed to fetch data: ${error.message}`);
    process.exit(1);
  }
}

main();
