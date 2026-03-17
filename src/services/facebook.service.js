import env from '../config/env.js';
import FormData from 'form-data';

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

export const sendFacebookFileMessage = async (recipientId, fileBuffer, filename = 'document.docx') => {
  if (!env.facebookPageAccessToken) {
    console.warn('[facebook.service] Missing FACEBOOK_PAGE_ACCESS_TOKEN, skip send file');
    return { skipped: true, reason: 'missing_token' };
  }

  const form = new FormData();
  form.append('recipient', JSON.stringify({ id: String(recipientId) }));
  form.append('messaging_type', 'RESPONSE');
  form.append(
    'message',
    JSON.stringify({
      attachment: {
        type: 'file',
        payload: { is_reusable: false },
      },
    })
  );
  form.append('filedata', fileBuffer, {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const response = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${env.facebookPageAccessToken}`, {
    method: 'POST',
    headers: form.getHeaders(),
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook send file failed: ${response.status} ${errorText}`);
  }

  return response.json();
};
