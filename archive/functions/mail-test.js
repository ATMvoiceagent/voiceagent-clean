exports.handler = async (context, event, callback) => {
  const to   = context.SENDGRID_TO || 'you+randywells@telus.net';
  const from = context.SENDGRID_FROM || 'no-reply@cashintime.ca';
  const name = context.SENDGRID_FROMNAME || 'Cash In Time Support';
  const api  = context.SENDGRID_API_KEY;

  const twiml = new (require('twilio').twiml.VoiceResponse)();

  if (!api || !to || !from) {
    console.log('[mail-test] missing env', { hasKey: !!api, to, from });
    return callback(null, '<Response/>');
  }

  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name },
    subject: 'ATM VoiceAgent: HTTP test',
    content: [{ type: 'text/plain', value: 'Hello from SendGrid HTTP' }]
  };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${api}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[mail-test] sendgrid status', res.status);
  } catch (e) {
    console.log('[mail-test] error', String(e));
  }

  return callback(null, '<Response/>');
};
