/**
 * Option 3 — Issues mini flow (speech only)
 * - Dynamic base URL (no hardcoded domain)
 * - First prompt includes examples; second prompt does not
 * - If still not understood, go to Option 4 (tech-callback)
 * - For "I didn't get my money" / no cash dispensed: only action is to text claim form
 */
exports.handler = async (context, event, callback) => {
  const twiml = new (require('twilio').twiml.VoiceResponse)();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  // Build dynamic base URL from request headers or DOMAIN_NAME
  const hdrs  = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'') || 'example.twil.io';
  const base  = `${proto}://${host}`;

  // Small intent matcher
  const getIntent = (text='') => {
    const s = String(text).toLowerCase();

    // "No cash dispensed" bucket
    const money =
      /\b(no\s+cash\s+dispensed|cash\s+not\s+dispensed|didn'?t\s+get\s+(my\s+)?(cash|money)|did\s+not\s+get\s+(my\s+)?(cash|money)|no\s+(cash|money))\b/;

    // "Card stuck" bucket (covers: my card is stuck, card stuck, stuck card, swallowed/kept my card)
    const card  =
      /\b(my\s+card\s+is\s+stuck|card\s+stuck|stuck\s+card|swallowed\s+my\s+card|kept\s+my\s+card|machine\s+kept\s+my\s+card|atm\s+kept\s+my\s+card)\b/;

    // "Screen frozen" bucket (broader wording)
    const screen=
      /\b((screen|display).*(frozen|freeze|freezing|blank|black|white|dead|unresponsive|not\s+responding|not\s+working)|screen\s+frozen)\b/;

    if (money.test(s))  return 'no_cash';
    if (card.test(s))   return 'card_stuck';
    if (screen.test(s)) return 'screen_frozen';
    return 'unknown';
  };

  // SMS helper for claim link
  const sendSms = async (to, body) => {
    if (!to) return;
    const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    const msg = { body, to };
    if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
    else if (context.SMS_FROM)         msg.from               = context.SMS_FROM;
    try { await client.messages.create(msg); } catch (e) { /* swallow for IVR continuity */ }
  };

  const step = event.step || 'start';

  // START — opening prompt with examples
  if (step === 'start') {
    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: `${base}/issues-mini?step=first`
    });
    g.say({ voice, language: 'en-US' },
      "Alright, briefly describe the issue you're having with the A T M. You can say, card stuck, screen frozen or I did not get my money.");
    return callback(null, twiml);
  }

  // FIRST — classify; if unknown, ask once more (no examples)
  if (step === 'first') {
    const said = event.SpeechResult || '';
    const intent = getIntent(said);

    if (intent === 'no_cash') {
      const to = event.From || '';
      const link = context.CLAIM_LINK || `${base}/claim.html`;
      const body = `ATM Claim — No cash dispensed.\nPlease complete the form: ${link}`;
      await sendSms(to, body);
      twiml.say({ voice }, "I've sent you a text message with a link to the claim form. Please fill it out and our team will follow up. Thanks for calling A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    if (intent === 'card_stuck') {
      twiml.say({ voice }, "Thanks. I’ll have a technician call you back to assist with the card retrieval.");
      twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=card_stuck`);
      return callback(null, twiml);
    }

    if (intent === 'screen_frozen') {
      twiml.say({ voice }, "Thanks. I’ll have a technician call you back to troubleshoot the display.");
      twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=screen_frozen`);
      return callback(null, twiml);
    }

    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: `${base}/issues-mini?step=second`
    });
    g.say({ voice, language: 'en-US' }, "Sorry, can you say that again?");
    return callback(null, twiml);
  }

  // SECOND — if still unknown, go to tech-callback
  if (step === 'second') {
    const said = event.SpeechResult || '';
    const intent = getIntent(said);

    if (intent === 'no_cash') {
      const to = event.From || '';
      const link = context.CLAIM_LINK || `${base}/claim.html`;
      const body = `ATM Claim — No cash dispensed.\nPlease complete the form: ${link}`;
      await sendSms(to, body);
      twiml.say({ voice }, "I've sent you a text message with a link to the claim form. Please fill it out and our team will follow up. Thanks for calling A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    if (intent === 'card_stuck') {
      twiml.say({ voice }, "Thanks. I’ll have a technician call you back to assist with the card retrieval.");
      twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=card_stuck`);
      return callback(null, twiml);
    }

    if (intent === 'screen_frozen') {
      twiml.say({ voice }, "Thanks. I’ll have a technician call you back to troubleshoot the display.");
      twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=screen_frozen`);
      return callback(null, twiml);
    }

    twiml.say({ voice }, "I’m having trouble understanding. I’ll have a technician call you back shortly.");
    twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=issues_unknown`);
    return callback(null, twiml);
  }

  // default
  twiml.redirect({ method: 'POST' }, `${base}/issues-mini?step=start`);
  return callback(null, twiml);
};
