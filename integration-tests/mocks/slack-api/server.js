const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


app.get('/api/conversations.list', (req, res) => {
  res.json({
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
});

app.get('/api/users.list', (req, res) => {
  res.json({
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
});

app.get('/api/conversations.history', (req, res) => {
  res.json({
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
});

app.listen(port, () => {
  console.log(`Mock Slack API server running on port ${port}`);
});
