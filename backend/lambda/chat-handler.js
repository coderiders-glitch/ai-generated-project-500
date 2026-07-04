const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'InteractionLogs';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// OpenAI integration
async function callOpenAI(message) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
      max_tokens: 150,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Save interaction to DynamoDB
async function saveInteraction(sessionId, userMessage, botResponse) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      id: uuidv4(),
      sessionId: sessionId,
      userMessage: userMessage,
      botResponse: botResponse,
      timestamp: new Date().toISOString()
    }
  };

  try {
    await dynamodb.put(params).promise();
  } catch (error) {
    console.error('Error saving interaction:', error);
    throw error;
  }
}

// Get chat history from DynamoDB
async function getChatHistory(sessionId) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': sessionId
    }
  };

  try {
    const result = await dynamodb.scan(params).promise();
    return result.Items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    throw error;
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path, body, queryStringParameters } = event;

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Health check endpoint
    if (httpMethod === 'GET' && path === '/') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Chat endpoint
    if (httpMethod === 'POST' && path === '/chat') {
      if (!body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Request body is required'
          })
        };
      }

      const { message, sessionId } = JSON.parse(body);

      if (!message) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Message is required'
          })
        };
      }

      const currentSessionId = sessionId || uuidv4();

      try {
        const botResponse = await callOpenAI(message);
        await saveInteraction(currentSessionId, message, botResponse);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            response: botResponse,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        console.error('Error processing chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Failed to process chat message'
          })
        };
      }
    }

    // Chat history endpoint
    if (httpMethod === 'GET' && path === '/chat/history') {
      const sessionId = queryStringParameters?.sessionId;

      if (!sessionId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'sessionId query parameter is required'
          })
        };
      }

      try {
        const history = await getChatHistory(sessionId);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            history: history,
            sessionId: sessionId
          })
        };
      } catch (error) {
        console.error('Error retrieving chat history:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Failed to retrieve chat history'
          })
        };
      }
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Route not found'
      })
    };

  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};