exports.handler = async (context, event, callback) => {
  const to   = context.SENDGRID_TO   || 'info@cashintime.ca';
  const from = context.SENDGRID_FROM || 'info@cashintime.ca';
  const key  = context.SENDGRID_API_KEY;

  const n = parseInt(event.NumMedia || '0', 10);
  const fromNum = event.From || '';
  const bodyTxt = event.Body || '';

  // build attachments list (first few media items)
  const attachments = [];
  for (let i = 0; i < n; i++) {
    const url = event[`MediaUrl${i}`];
    const type = event[`MediaContentType${i}`] || 'application/octet-stream';
    if (!url) continue;
    // Let SendGrid fetch using "content" as a URL? It can't.
    // So we inline a simple pointer list in the email body instead (most reliable).
    // If you want true file attachments, we can fetch and base64 them here.
  }

  const text =
    `Inbound MMS from ${fromNum}\n\n` +
    (bodyTxt ? `Message:\n${bodyTxt}\n\n` : '') +
    (n ? `Media URLs:\n${Array.from({length:n}, (_,i)=> event['MediaUrl'+i]).join('\n')}\n` : 'No media.\n');

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject: `ATM VoiceAgent MMS from ${fromNum}`,
        content: [{ type: 'text/plain', value: text }]
      })
    });
    console.log('[mms-email-v2]', { from: fromNum, n, sent: res.status, err: '' });
  } catch (e) {
    console.log('[mms-email-v2][error]', e.toString());
  }
  return callback(null, '<Response/>');
};
