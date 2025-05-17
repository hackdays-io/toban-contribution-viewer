const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors({ origin: '*' }));

const JWT_SECRET = 'test-jwt-secret';
const TOKEN_EXPIRY = '1h';

const users = {
  'test@example.com': {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  }
};

const sessions = {};

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


app.post('/auth/v1/token', (req, res) => {
  const { email, password } = req.body;
  
  if (req.body.grant_type === 'refresh_token') {
    const { refresh_token } = req.body;
    
    if (!refresh_token || !sessions[refresh_token]) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const user = sessions[refresh_token].user;
    const newTokens = generateTokens(user);
    
    delete sessions[refresh_token];
    sessions[newTokens.refresh_token] = {
      user,
      access_token: newTokens.access_token
    };
    
    return res.json({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      user: user,
      expires_in: 3600
    });
  }
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (!users[email] || users[email].password !== password) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }
  
  const user = { ...users[email] };
  delete user.password;
  
  const tokens = generateTokens(user);
  
  sessions[tokens.refresh_token] = {
    user,
    access_token: tokens.access_token
  };
  
  res.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user: user,
    expires_in: 3600
  });
});

app.post('/auth/v1/signup', (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const userId = `user-${Date.now()}`;
  users[email] = {
    id: userId,
    email,
    password,
    name: name || email.split('@')[0]
  };
  
  const user = { ...users[email] };
  delete user.password;
  
  const tokens = generateTokens(user);
  
  sessions[tokens.refresh_token] = {
    user,
    access_token: tokens.access_token
  };
  
  res.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user: user,
    expires_in: 3600
  });
});

app.get('/auth/v1/user', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;
    
    let user = null;
    for (const email in users) {
      if (users[email].id === userId) {
        user = { ...users[email] };
        delete user.password;
        break;
      }
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/auth/v1/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  for (const refreshToken in sessions) {
    if (sessions[refreshToken].access_token === token) {
      delete sessions[refreshToken];
    }
  }
  
  res.json({ message: 'Signed out successfully' });
});

function generateTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = `${user.id}-${Date.now()}`;
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
}

app.post('/reset', (req, res) => {
  Object.keys(users).forEach(key => {
    if (key !== 'test@example.com') {
      delete users[key];
    }
  });
  
  Object.keys(sessions).forEach(key => {
    delete sessions[key];
  });
  
  res.json({ status: 'ok', message: 'Data reset successful' });
});

app.listen(port, () => {
  console.log(`Mock Auth API server running on port ${port}`);
});
