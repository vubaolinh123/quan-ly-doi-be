import env from '../config/env.js';

export const sendFacebookMessage = async (recipientId, messageText) => {
  if (!env.facebookPageAccessToken) {
    console.log('[FacebookService] No token, skipping send. Message:', messageText);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${env.facebookPageAccessToken}`;
  const body = {
    recipient: { id: recipientId },
    message: { text: messageText }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[FacebookService] Send failed:', err);
  }
};
