// /functions/issues-mini.js
// Mini issues triage with speech, one nudge then goodbye, and geo-reboot path.

exports.handler = async (context, event, callback) => {
  const twiml = new (require('twilio').twiml.VoiceResponse)();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  const hdrs = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'') || 'example.twil.io';
  const base  = `${proto}://${host}`;

  const CLAIM_LINK = context.CLAIM_LINK || `${base}/claim.html`;
  const GEO_URL    = context.GEO_URL    || `${base}/assist.html?mode=geo`;

  // nudge helper: one nudge then goodbye
  const NU = String(event.n || '0');
  const goodbyeOrNudge = (retryUrl) => {
    if (NU === '1') {
      twiml.say({ voice }, "Okay, call us back if you would like more information. Goodbye.");
      twiml.hangup();
      return true;
    }
    twiml.redirect({ method: 'POST' }, `${retryUrl}${retryUrl.includes('?') ? '&' : '?'}n=1`);
    return false;
  };

  const step = event.step || 'start';

  // --- Step: start (ask for issue) ---
  if (step === 'start') {
    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: `${base}/issues-mini?step=first`,
      actionOnEmptyResult: true
    });
    g.say({ voice, language: 'en-US' },
      "Alright, briefly describe the issue you're having with the A T M. You can say, card stuck, screen frozen or I did not get my money.");
    if (!goodbyeOrNudge(`${base}/issues-mini?step=start`)) {}
    return callback(null, twiml);
  }

  // Normalize transcript text
  const raw = (event.SpeechResult || '').toString();
  const text = raw.trim().toLowerCase();

  // --- Step: first (try to classify) ---
  if (step === 'first') {
    // Decision by simple keyword groups
    const isCardStuck   = /\b(card|bank card|debit|credit)\b.*\bstuck\b|\bstuck\b.*\bcard\b/.test(text) || /my card is stuck/.test(text);
    const isFrozen      = /\b(screen|display|touch)\b.*\b(frozen|freez|unresponsive)\b|\b(frozen|freez)\b.*\bscreen\b/.test(text);
    const isNoCash      = /\b(didn.?t|get|dispense|received?)\b.*\b(cash|money)\b|\bno cash\b|\bno money\b|\bi didn'?t get my money\b/.test(text);

    // card stuck → geo link + auto reboot copy (card retrieval)
    if (isCardStuck) {
      await sendGeoLinkSms(context, event.From, GEO_URL);
      twiml.say({ voice },
        "Okay, I’m sending you a secure text link to locate the A T M. Please tap the link to share your location, which will enable us to automatically reboot the A T M. Once the power is cut, you’ll be able to retrieve your card. If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M. If you're still unable to get your card, please call us back and select option 4. A technician will return your call. Thank you for contacting A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    // screen frozen → geo link + auto reboot copy (reset ATM)
    if (isFrozen) {
      await sendGeoLinkSms(context, event.From, GEO_URL);
      twiml.say({ voice },
        "Okay, I’m sending you a secure text link to locate the A T M. Please tap the link to share your location, which will enable us to automatically reboot the A T M. This will reset the A T M, and it should be ready for use once it powers back up. This action will also release your card if it’s currently stuck. If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M. If you're still unable to get your card, please call us back and select option 4. A technician will return your call. Thank you for contacting A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    // didn't get my money → send claim link
    if (isNoCash) {
      await sendClaimSms(context, event.From, CLAIM_LINK);
      twiml.say({ voice },
        "I've sent you a text message with a link to the claim form. Please fill it out and our team will follow up. Thanks for calling A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    // Unknown → ask again (second chance)
    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: `${base}/issues-mini?step=second`,
      actionOnEmptyResult: true
    });
    g.say({ voice, language: 'en-US' }, "Sorry, can you say that again?");
    if (!goodbyeOrNudge(`${base}/issues-mini?step=first`)) {}
    return callback(null, twiml);
  }

  // --- Step: second (fallback to tech callback if still unknown) ---
  if (step === 'second') {
    const txt = text;
    const isCardStuck2 = /\bcard\b.*\bstuck\b|\bstuck\b.*\bcard\b/.test(txt);
    const isFrozen2    = /\bscreen\b.*\b(frozen|freez)\b|\b(frozen|freez)\b.*\bscreen\b/.test(txt);
    const isNoCash2    = /\bdidn.?t get (my )?money\b|\bno cash\b|\bno money\b/.test(txt);

    if (isCardStuck2 || isFrozen2 || isNoCash2) {
      // loop back to first so we reuse the same branching & SMS logic
      twiml.redirect({ method: 'POST' }, `${base}/issues-mini?step=first&SpeechResult=${encodeURIComponent(raw)}`);
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

// --- SMS helpers ---
async function sendGeoLinkSms(context, to, url) {
  if (!to) return;
  const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const body = "Please click the link to share your ATM location: " + url;
  const msg = { body, to };
  if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
  else if (context.SMS_FROM) msg.from = context.SMS_FROM;
  try { await client.messages.create(msg); } catch (_) {}
}

async function sendClaimSms(context, to, url) {
  if (!to) return;
  const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const body = "Claim form link: " + url;
  const msg = { body, to };
  if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
  else if (context.SMS_FROM) msg.from = context.SMS_FROM;
  try { await client.messages.create(msg); } catch (_) {}
}
