const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const loadDataFromFile = (filename, defaultData) => {
  try {
    const dataPath = path.join(__dirname, 'data', filename);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log(`Loaded data from ${dataPath}`);
      return data;
    } else {
      console.log(`File ${dataPath} not found, using default data`);
      return defaultData;
    }
  } catch (error) {
    console.error(`Error loading data from ${filename}:`, error);
    return defaultData;
  }
};

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/conversations.list', (req, res) => {
  const data = loadDataFromFile('conversations.json', {
    ok: true,
    channels: [
      {
        id: 'C01234567',
        name: 'general',
        is_channel: true,
        is_private: false,
        is_archived: false
      },
      {
        id: 'C01234568',
        name: 'random',
        is_channel: true,
        is_private: false,
        is_archived: false
      }
    ]
  });
  res.json(data);
});

app.get('/api/users.list', (req, res) => {
  const data = loadDataFromFile('users.json', {
    ok: true,
    members: [
      {
        id: 'U01234567',
        name: 'user1',
        real_name: 'User One',
        profile: {
          display_name: 'User 1',
          email: 'user1@example.com'
        }
      },
      {
        id: 'U01234568',
        name: 'user2',
        real_name: 'User Two',
        profile: {
          display_name: 'User 2',
          email: 'user2@example.com'
        }
      }
    ]
  });
  res.json(data);
});

app.get('/api/conversations.history', (req, res) => {
  const channelId = req.query.channel || 'C01234567';
  const data = loadDataFromFile(`conversations_history_${channelId}.json`, {
    ok: true,
    messages: [
      {
        type: 'message',
        user: 'U01234567',
        text: 'Hello world',
        ts: '1614267200.000100'
      },
      {
        type: 'message',
        user: 'U01234568',
        text: 'Hi there!',
        ts: '1614267300.000200'
      }
    ],
    has_more: false
  });
  res.json(data);
});

app.get('/api/users.info', (req, res) => {
  const userId = req.query.user;
  if (!userId) {
    return res.json({ ok: false, error: 'user_not_found' });
  }

  const usersData = loadDataFromFile('users.json', {
    members: [
      { id: 'U01234567', name: 'user1', real_name: 'User One' },
      { id: 'U01234568', name: 'user2', real_name: 'User Two' }
    ]
  });

  const user = usersData.members.find(u => u.id === userId);
  if (!user) {
    return res.json({ ok: false, error: 'user_not_found' });
  }

  res.json({ ok: true, user });
});

app.post('/api/oauth.v2.access', (req, res) => {
  const data = loadDataFromFile('oauth.json', {
    ok: true,
    access_token: 'xoxb-test-token',
    token_type: 'bot',
    scope: 'channels:history,channels:read,users:read',
    bot_user_id: 'B12345',
    app_id: 'A12345',
    team: {
      id: 'T12345',
      name: 'Test Team',
      domain: 'testteam'
    },
    enterprise: null,
    authed_user: {
      id: 'U12345',
      scope: 'chat:write',
      access_token: 'xoxp-test-token',
      token_type: 'user'
    },
    is_enterprise_install: false
  });
  
  const { client_id, client_secret, code } = req.body;
  if (!client_id || !client_secret || !code) {
    return res.json({ ok: false, error: 'invalid_request' });
  }
  
  res.json(data);
});

app.listen(port, () => {
  console.log(`Mock Slack API server running on port ${port}`);
});
