const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body;
  
  const responseContent = generateMockResponse(messages);
  
  res.json({
    id: `mock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || 'anthropic/claude-3-opus:20240229',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 150,
      total_tokens: 250
    }
  });
});

function generateMockResponse(messages) {
  if (messages.some(msg => msg.content && msg.content.includes('contribution'))) {
    return `
      Based on the Slack conversation data provided, here are the key contributors:
      
      1. User One (user1): Primary contributor with thoughtful responses and technical guidance
      2. User Two (user2): Active participant who asks clarifying questions
      
      The conversation shows a collaborative problem-solving approach with User One providing technical expertise while User Two helps refine the solution through questions.
    `;
  }
  
  if (messages.some(msg => msg.content && msg.content.includes('topic'))) {
    return `
      The main topics discussed in this conversation are:
      
      1. Project setup (40%): Discussion about environment configuration and dependencies
      2. Testing strategy (35%): Conversation about testing approaches and frameworks
      3. Documentation (25%): Comments about improving project documentation
      
      The conversation primarily focused on technical implementation details with an emphasis on quality assurance.
    `;
  }
  
  return `
    I've analyzed the provided data and found several interesting patterns. The team communication shows good collaboration with regular check-ins and updates. There appears to be a balanced distribution of contributions across team members with a focus on problem-solving and knowledge sharing.
  `;
}

app.listen(port, () => {
  console.log(`Mock OpenRouter API server running on port ${port}`);
});
