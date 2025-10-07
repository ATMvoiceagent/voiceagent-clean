// /issues.js — Option 3 (Issues)
// Pacing: 0.5s pauses between sentences (no SSML).
// Flows:
//  • 1 Card Stuck → confirm number → SMS GEO_URL → reboot guidance
//  • 2 Screen Frozen → confirm number → SMS GEO_URL → reboot guidance
//  • 3 Didn't get money → confirm number → SMS CLAIM_LINK → expanded guidance (updated script)
//  • 4 Other → tech-callback
//
// Env: SMS_FROM (or CALLER_ID), GEO_URL, CLAIM_LINK

exports.handler = async function (context, event, callback) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const SMS_FROM  = context.SMS_FROM || context.CALLER_ID || '';
  const GEO_URL   = context.GEO_URL   || 'https://citvan-clean-6447-ui.twil.io/assist.html?mode=geo';
  const CLAIM_LINK= context.CLAIM_LINK|| 'https://citvan-clean-6447-ui.twil.io/claim.html';

  const step   = (event.step || 'menu').toString();
  const digits = (event.Digits || '').toString().trim();
  const from   = normalizeE164(event.From || event.from || '');
  const mode   = (event.mode || 'card').toString(); // 'card' | 'screen' | 'claim'

  // Speak helper: split on sentence boundaries, insert <Pause/>
  function say(r, text, pauseSeconds = 0.5) {
    const parts = String(text).split(/\.\s+/).filter(Boolean);
    parts.forEach((p, i) => {
      r.say({ voice: 'Polly.Joanna-Neural' }, p.endsWith('.') ? p : p + '.');
      if (i < parts.length - 1) r.pause({ length: pauseSeconds });
    });
  }
  function log(tag, obj) { try { console.log(`[issues] ${JSON.stringify({ step, tag, mode, From: from, Digits: digits, ...obj })}`); } catch {} }
  function baseUrl(ctx) {
    const host = ctx.DOMAIN_NAME || ctx.DOMAIN || 'citvan-clean-6447-ui.twil.io';
    return `https://${host}`;
  }
  function absUrl(ctx, path, qs = {}) {
    const url = new URL(baseUrl(ctx) + path);
    for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
    return url.toString();
  }
  function normalizeE164(num) {
    if (!num) return '';
    let d = String(num).replace(/\D/g, '');
    if (d.length === 10) d = '1' + d;
    if (!d.startsWith('1')) return '';
    return '+' + d;
  }
  async function safeSms(client, to, body) {
    try {
      const msg = await client.messages.create({ from: SMS_FROM, to, body });
      log('sms_sent', { to, sid: msg.sid });
    } catch (e) {
      log('sms_err', { to, code: e?.code, msg: e?.message });
    }
  }

  const twiml = new VoiceResponse();
  log('req', {});

  // ===== MAIN MENU (for this function) =====
  if (step === 'menu') {
    const next = absUrl(context, '/issues', { step: 'handle', from });
    const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 6, action: next, method: 'POST' });
    say(g, "If your card is stuck press 1, if the screen is frozen press 2, if you didn't get your money press 3, for any other issue press 4.");
    return callback(null, twiml);
  }

  // ===== HANDLE =====
  if (step === 'handle') {
    const client = context.getTwilioClient();

    // ---- 1) CARD STUCK ----
    if (digits === '1') {
      const next = absUrl(context, '/issues', { step: 'confirm_number', from, mode: 'card' });
      say(twiml,
        "The ATM needs to be powered off in order for you to retrieve your card. " +
        "To help identify the correct ATM terminal, I need to text you a secure link so you can share your location with me. " +
        "This allows me to locate the exact ATM terminal number, so I can send an automatic reboot which will release your card.");
      const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: next, method: 'POST' });
      const end4 = from ? from.slice(-4) : 'XXXX';
      say(g, `Press 1 to confirm the mobile number ending in ${end4}. Press 2 to enter a different 10-digit mobile number. Or press 3 if you would rather have a technician call you back.`);
      return callback(null, twiml);
    }

    // ---- 2) SCREEN FROZEN ----
    if (digits === '2') {
      const next = absUrl(context, '/issues', { step: 'confirm_number', from, mode: 'screen' });
      say(twiml,
        "The ATM needs to be powered off in order for it to come back into service. " +
        "To help identify the correct ATM terminal, I need to text you a secure link so you can share your location with me. " +
        "This allows me to locate the exact ATM terminal number, so I can send an automatic reboot which will restart the ATM.");
      const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: next, method: 'POST' });
      const end4 = from ? from.slice(-4) : 'XXXX';
      say(g, `Press 1 to confirm the mobile number ending in ${end4}. Press 2 to enter a different 10-digit mobile number. Or press 3 if you would rather have a technician call you back.`);
      return callback(null, twiml);
    }

    // ---- 3) DIDN'T GET MONEY (updated intro line) ----
    if (digits === '3') {
      const next = absUrl(context, '/issues', { step: 'confirm_number', from, mode: 'claim' });
      const end4 = from ? from.slice(-4) : 'XXXX';
      // UPDATED: your exact intro
      say(twiml, "Alright, let me send you a link to our transaction claim form.");
      const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: next, method: 'POST' });
      say(g, `Press 1 to confirm the mobile number ending in ${end4}. Press 2 to enter a different 10-digit mobile number. Or press 3 if you would rather have a technician call you back.`);
      return callback(null, twiml);
    }

    // ---- 4) OTHER ----
    if (digits === '4') {
      const url = absUrl(context, '/tech-callback', { step: 'start', reason: 'issues_other' });
      twiml.redirect({ method: 'POST' }, url);
      return callback(null, twiml);
    }

    twiml.redirect(absUrl(context, '/issues', { step: 'menu', from }));
    return callback(null, twiml);
  }

  // ===== CONFIRM NUMBER (shared) =====
  if (step === 'confirm_number') {
    const client = context.getTwilioClient();

    if (digits === '1') {
      const body = mode === 'claim'
        ? `ATM Support: Transaction claim form: ${CLAIM_LINK}`
        : `ATM Support: Secure location link to identify the terminal: ${GEO_URL}`;
      await safeSms(client, from, body);

      if (mode === 'claim') {
        // UPDATED: your exact closing starting with "Okay, I sent it."
        say(twiml,
          "Okay, I sent it. " +
          "Please fill it out and attach a picture of your receipt, if you have one, so we can initiate the refund process. " +
          "As well, to expedite this, please call the 1-800 number on the back of your bank card and inform your financial institution that you need to initiate a trace request for your transaction because you didn't get your money. " +
          "Depending on your bank, the process can take up to 10 days. " +
          "Call us back if you require any additional assistance. " +
          "Thank you for contacting ATM support. Goodbye!");
      } else {
        say(twiml, "I've sent the reboot command. If the reboot is unsuccessful, please try unplugging the power cord to the ATM, or you can call us back and we'll connect you with a technician. Thank you for contacting ATM support. Goodbye!");
      }
      twiml.hangup(); return callback(null, twiml);
    }

    if (digits === '2') {
      const next = absUrl(context, '/issues', { step: 'enter_number', from, mode });
      const g = twiml.gather({ input: 'dtmf', numDigits: 10, timeout: 12, action: next, method: 'POST' });
      say(g, "Please enter the 10-digit mobile number where you would like to receive the text link, then press the pound sign.");
      return callback(null, twiml);
    }

    if (digits === '3') {
      const reason =
        mode === 'screen' ? 'screen_frozen_callback' :
        mode === 'card'   ? 'card_stuck_callback'   :
                            'claim_callback';
      const url = absUrl(context, '/tech-callback', { step: 'start', reason });
      twiml.redirect({ method: 'POST' }, url);
      return callback(null, twiml);
    }

    twiml.redirect(absUrl(context, '/issues', { step: 'menu', from }));
    return callback(null, twiml);
  }

  // ===== ENTER NEW NUMBER (shared) =====
  if (step === 'enter_number') {
    const client = context.getTwilioClient();
    const newNum = normalizeE164(digits);
    if (!newNum) {
      const retry = absUrl(context, '/issues', { step: 'confirm_number', from, mode });
      say(twiml, "That number didn't seem valid. Let's try again.");
      twiml.redirect({ method: 'POST' }, retry);
      return callback(null, twiml);
    }
    const body = mode === 'claim'
      ? `ATM Support: Transaction claim form: ${CLAIM_LINK}`
      : `ATM Support: Secure location link to identify the terminal: ${GEO_URL}`;
    await safeSms(client, newNum, body);

    if (mode === 'claim') {
      // UPDATED: your exact closing starting with "Okay, I sent it."
      say(twiml,
        "Okay, I sent it. " +
        "Please fill it out and attach a picture of your receipt, if you have one, so we can initiate the refund process. " +
        "As well, to expedite this, please call the 1-800 number on the back of your bank card and inform your financial institution that you need to initiate a trace request for your transaction because you didn't get your money. " +
        "Depending on your bank, the process can take up to 10 days. " +
        "Call us back if you require any additional assistance. " +
        "Thank you for contacting ATM support. Goodbye!");
    } else {
      say(twiml, "I've sent the reboot command to that number. If the reboot is unsuccessful, please try unplugging the power cord to the ATM, or you can call us back and we'll connect you with a technician. Thank you for contacting ATM support. Goodbye!");
    }
    twiml.hangup(); return callback(null, twiml);
  }

  // ===== FALLBACK =====
  twiml.redirect(absUrl(context, '/issues', { step: 'menu', from }));
  return callback(null, twiml);
};
