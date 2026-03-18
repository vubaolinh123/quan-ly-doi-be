import env from '../config/env.js';

const GRAPH_API_BASE = `https://graph.facebook.com/${env.facebookGraphApiVersion}`;

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

/**
 * Send a file attachment to a Facebook Messenger user via the Send API.
 *
 * Uses Node.js native FormData + Blob (available since Node 18) instead of
 * the `form-data` npm package.  The npm package produces a Node stream that
 * is NOT properly consumed by Node's native `fetch` (undici), causing the
 * multipart boundary to be lost and the request to silently fail.
 *
 * Facebook Send API supported attachment types: image, audio, video, file.
 * The "file" type supports any document up to 25 MB.
 */
export const sendFacebookFileMessage = async (recipientId, fileBuffer, filename = 'document.docx') => {
  if (!env.facebookPageAccessToken) {
    console.warn('[facebook.service] Missing FACEBOOK_PAGE_ACCESS_TOKEN, skip send file');
    return { skipped: true, reason: 'missing_token' };
  }

  // Convert Buffer to Blob (Node 18+ native)
  const blob = new Blob(
    [fileBuffer],
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  );

  // Use native FormData — compatible with native fetch()
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
  form.append('filedata', blob, filename);

  const url = `${GRAPH_API_BASE}/me/messages?access_token=${env.facebookPageAccessToken}`;

  console.info(
    '[facebook.service] Sending file to %s: %s (%d bytes)',
    recipientId, filename, fileBuffer.length
  );

  // Do NOT set Content-Type manually — native fetch auto-sets it with the
  // correct multipart boundary when body is a native FormData.
  const response = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      '[facebook.service] Direct file send failed: %s %s — trying attachment upload fallback',
      response.status, errorText
    );
    return uploadAttachmentAndSend(recipientId, fileBuffer, filename);
  }

  const result = await response.json();
  console.info('[facebook.service] File sent successfully to %s: messageId=%s', recipientId, result?.message_id);
  return result;
};

/**
 * Fallback: upload file via Attachment Upload API, then send message
 * referencing the attachment_id. Used when direct multipart send fails.
 *
 * Step A: POST /me/message_attachments → { attachment_id }
 * Step B: POST /me/messages with attachment_id
 */
const uploadAttachmentAndSend = async (recipientId, fileBuffer, filename) => {
  const blob = new Blob(
    [fileBuffer],
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  );

  // Step A: Upload to message_attachments
  const uploadForm = new FormData();
  uploadForm.append(
    'message',
    JSON.stringify({ attachment: { type: 'file', payload: { is_reusable: true } } })
  );
  uploadForm.append('filedata', blob, filename);

  const uploadUrl = `${GRAPH_API_BASE}/me/message_attachments?access_token=${env.facebookPageAccessToken}`;
  console.info('[facebook.service] Uploading attachment: %s (%d bytes)', filename, fileBuffer.length);

  const uploadResp = await fetch(uploadUrl, { method: 'POST', body: uploadForm });
  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Attachment upload failed: ${uploadResp.status} ${errText}`);
  }
  const { attachment_id } = await uploadResp.json();
  console.info('[facebook.service] Attachment uploaded: attachment_id=%s', attachment_id);

  // Step B: Send message referencing attachment_id
  const sendResp = await fetch(
    `${GRAPH_API_BASE}/me/messages?access_token=${env.facebookPageAccessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: String(recipientId) },
        messaging_type: 'RESPONSE',
        message: { attachment: { type: 'file', payload: { attachment_id } } },
      }),
    }
  );
  if (!sendResp.ok) {
    const errText = await sendResp.text();
    throw new Error(`Send with attachment_id failed: ${sendResp.status} ${errText}`);
  }
  const result = await sendResp.json();
  console.info(
    '[facebook.service] File sent via attachment_id to %s: messageId=%s',
    recipientId, result?.message_id
  );
  return result;
};
