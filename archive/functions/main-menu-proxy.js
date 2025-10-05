exports.handler = async (context, event, callback) => {
  const { twiml: { VoiceResponse } } = require('twilio');
  const twiml = new VoiceResponse();

  // Build a base URL from headers (so it works in any environment)
  const hdrs  = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'') || 'example.twil.io';
  const base  = `${proto}://${host}`;

  const callSid = event.CallSid || '';
  console.log('[proxy] inbound', { path: '/main-menu-proxy', method: 'POST', from: event.From, to: event.To });

  // Start full-call recording via REST — keep it minimal (no track/channels) for best compatibility
  try {
    const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    await client.calls(callSid).recordings.create({
      recordingStatusCallback: `${base}/recording-status`,
      recordingStatusCallbackMethod: 'POST'
    });
    console.log('[recording] started', { callSid });
  } catch (e) {
    console.error('[recording] failed to start', { callSid, err: String(e) });
    // Non-fatal — continue the call
  }

  // Hand off to your real IVR
  twiml.redirect({ method: 'POST' }, '/main-menu?step=menu');
  return callback(null, twiml);
};
