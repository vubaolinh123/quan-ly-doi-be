import env from '../config/env.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

export const sendFacebookTextMessage = async (recipientId, text) => {
  if (!env.facebookPageAccessToken) {
    console.warn('[facebook.service] Missing FACEBOOK_PAGE_ACCESS_TOKEN, skip send message');
    return { skipped: true, reason: 'missing_token' };
  }

  const response = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${env.facebookPageAccessToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: String(recipientId) },
      messaging_type: 'RESPONSE',
      message: { text }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook send message failed: ${response.status} ${errorText}`);
  }

  return response.json();
};
