// /functions/issues-mini.js
// Option 3: "Issues mini" — detect intents, auto-SMS geo link, and speak tailored scripts.
// Intents covered: "card stuck", "screen frozen", "didn't get my money" (claim link).
// One-nudge-then-bye on any missing user input elsewhere is handled in other functions.

exports.handler = async (context, event, callback) => {
  const { VoiceResponse } = require('twilio').twiml;
  const twiml = new VoiceResponse();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  // Build base URL dynamically (no hardcoding)
  const hdrs = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'') || 'example.twil.io';
  const base  = `${proto}://${host}`;

  const step = String(event.step || 'start');

  // Helper: send the geo link SMS using MSG service or SMS_FROM
  async function sendGeoSms(to) {
    if (!to) return;
    const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    const body = `Please click the link to share your ATM location:\n${context.GEO_URL}`;
    const msg = { to, body };
    if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
    else msg.from = context.SMS_FROM;
    try {
      await client.messages.create(msg);
      console.log('[issues-mini] geo SMS sent', { to });
    } catch (e) {
      console.log('[issues-mini] geo SMS error', e.message);
    }
  }

  // Helper: send claim link SMS
  async function sendClaimSms(to) {
    if (!to) return;
    const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    const claim = context.CLAIM_LINK || `${base}/claim.html`;
    const body = `Claim form link:\n${claim}`;
    const msg = { to, body };
    if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
    else msg.from = context.SMS_FROM;
    try {
      await client.messages.create(msg);
      console.log('[issues-mini] claim SMS sent', { to });
    } catch (e) {
      console.log('[issues-mini] claim SMS error', e.message);
    }
  }

  if (step === 'start') {
    // Ask for a short description
    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: `${base}/issues-mini?step=first`,
    });
    g.say({ voice, language: 'en-US' },
      "Alright, briefly describe the issue you're having with the A T M. " +
      "You can say, card stuck, screen frozen or I did not get my money."
    );
    return callback(null, twiml);
  }

  if (step === 'first') {
    const said = String(event.SpeechResult || '').toLowerCase();
    console.log('[issues-mini] first', { said });

    // Simple intent detection
    const isCardStuck =
      /\b(card\s+is\s+stuck|card\s+stuck|my\s+card\s+is\s+stuck)\b/.test(said);
    const isScreenFrozen =
      /\b(screen\s+frozen|screen\s+is\s+frozen|touch\s*screen\s*(?:is\s*)?unresponsive|touchscreen\s*(?:is\s*)?unresponsive|screen\s*(?:is\s*)?unresponsive)\b/.test(said);
    const isNoCash =
      /(didn[’']?t\s+get\s+my\s+money|did\s+not\s+get\s+my\s+money|no\s+cash|no\s+money)/.test(said);

    const from = event.From || '';

    // --- SCREEN FROZEN: auto SMS geo link + reboot path ---
    if (isScreenFrozen) {
      if (from) await sendGeoSms(from);

      twiml.say({ voice },
        "Okay, I’m sending you a secure text link to locate the A T M. " +
        "Please tap the link to share your location, which will enable us to automatically reboot the A T M. " +
        "This will reset the A T M, and it should be ready for use once it powers back up. " +
        "This action will also release your card if it’s currently stuck. " +
        "If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M. " +
        "If you're still unable to get your card, please call us back and select option 4. " +
        "A technician will return your call. Thank you for contacting A T M support. Goodbye."
      );
      twiml.hangup();
      return callback(null, twiml);
    }

    // --- CARD STUCK: auto SMS geo link + reboot path ---
    if (isCardStuck) {
      if (from) await sendGeoSms(from);

      twiml.say({ voice },
        "Okay, I’m sending you a secure text link to locate the A T M. " +
        "Please tap the link to share your location, which will enable us to automatically reboot the A T M. " +
        "Once the power is cut, you’ll be able to retrieve your card. " +
        "If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M. " +
        "If you're still unable to get your card, please call us back and select option 4. " +
        "A technician will return your call. Thank you for contacting A T M support. Goodbye."
      );
      twiml.hangup();
      return callback(null, twiml);
    }

    // --- DIDN'T GET CASH: SMS claim form + hangup ---
    if (isNoCash) {
      if (from) await sendClaimSms(from);

      twiml.say({ voice },
        "I've sent you a text message with a link to the claim form. " +
        "Please fill it out and our team will follow up. " +
        "Thanks for calling A T M support. Goodbye."
      );
      twiml.hangup();
      return callback(null, twiml);
    }

    // --- Unknown issue → offer tech callback flow ---
    twiml.say({ voice },
      "I’m having trouble understanding. I’ll have a technician call you back shortly."
    );
    twiml.redirect({ method: 'POST' }, `${base}/tech-callback?step=start&reason=issues_unknown`);
    return callback(null, twiml);
  }

  // Fallback: go to start
  twiml.redirect({ method: 'POST' }, `${base}/issues-mini?step=start`);
  return callback(null, twiml);
};
