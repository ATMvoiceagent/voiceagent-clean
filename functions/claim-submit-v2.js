exports.handler = async (context, event, callback) => {
  const to   = context.SENDGRID_TO   || 'info@cashintime.ca';
  const from = context.SENDGRID_FROM || 'info@cashintime.ca';
  const key  = context.SENDGRID_API_KEY;

  const fields = Object.keys(event).sort().map(k => `${k}: ${event[k]}`).join('\n');

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
        subject: 'ATM Claim submission',
        content: [{ type: 'text/plain', value: fields }]
      })
    });
    console.log('[claim-submit-v2]', { status: res.status });
  } catch (e) {
    console.log('[claim-submit-v2][error]', e.toString());
  }
  return callback(null, '<Response/>');
};
