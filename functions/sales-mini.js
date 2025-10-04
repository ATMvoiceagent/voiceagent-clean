// /functions/sales-mini.js
// Simple shim so any legacy hits to /sales-mini land on /sales?step=menu

exports.handler = async (context, event, callback) => {
  const twiml = new (require('twilio').twiml.VoiceResponse)();

  // Build base URL from request headers (no hardcoding domains)
  const h = event.headers || {};
  const proto = h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || 'https';
  const host  = h.host || h.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'');
  const base  = `${proto}://${host}`;

  const homeUrl = event.homeUrl || '/main-menu';
  twiml.redirect({ method: 'POST' }, `${base}/sales?step=menu&homeUrl=${encodeURIComponent(homeUrl)}`);
  return callback(null, twiml);
};
