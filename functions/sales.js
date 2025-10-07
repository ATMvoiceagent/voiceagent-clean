// /sales.js - Option 1 (Sales): website SMS or speak with Jeff
// Update: speak "Okay, let me transfer you to Jeff now." before dialing sales.
// Uses only SALES_NUMBER; Dial callerId uses CALLER_ID.

exports.handler = async function (context, event, callback) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;

  // --- ENV
  const SMS_FROM     = context.SMS_FROM || context.CALLER_ID || '';
  const WEBSITE_URL  = context.WEBSITE_URL || 'https://cashintime.ca';
  const CALLER_ID    = context.CALLER_ID || '';
  const SALES_NUMBER = context.SALES_NUMBER || '';

  // --- INPUTS
  const step   = (event.step || 'choice').toString();
  const from   = normalizeE164(event.From || event.from || '');
  const digits = (event.Digits || '').toString().trim();
  const n      = parseInt(event.n || '0', 10) || 0;

  // --- HELPERS
  function baseUrl(ctx) {
    const host = ctx.DOMAIN_NAME || ctx.DOMAIN || 'citvan-clean-6447-ui.twil.io';
    return `https://${host}`;
  }
  function absUrl(ctx, path, qs = {}) {
    const url = new URL(baseUrl(ctx) + path);
    for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
    return url.toString();
  }
  function last4(num) {
    const d = (num || '').replace(/\D/g, '');
    return d.slice(-4) || 'XXXX';
  }
  function normalizeE164(num) {
    if (!num) return '';
    let d = num.toString().replace(/\D/g, '');
    if (d.length === 10) d = '1' + d;
    if (!d.startsWith('1')) return '';
    return '+' + d;
  }
  function say(r, text) { r.say({ voice: 'Polly.Joanna-Neural' }, text); }
  function log(tag, obj) { try { console.log(`[sales] ${JSON.stringify({ step, tag, ...obj })}`); } catch {} }
  async function safeSms(client, to, body) {
    try {
      const msg = await client.messages.create({ from: SMS_FROM, to, body });
      log('sms', { action: 'sent', to, from_used: SMS_FROM, sid: msg.sid });
    } catch (e) {
      log('sms', { action: 'error', to, from_used: SMS_FROM, code: e?.code, message: e?.message });
    }
  }
  function nudgeOrBye(r, reprompt, nextUrl) {
    if (n >= 1) { say(r, "No problem. Call us back if you need anything. Goodbye."); r.hangup(); return true; }
    const g = r.gather({ input: 'dtmf', numDigits: 1, timeout: 5, action: nextUrl + `&n=${n + 1}`, method: 'POST' });
    say(g, reprompt);
    return false;
  }

  // --- START
  const twiml = new VoiceResponse();
  log('request', { Digits: digits, From: from, SALES_NUMBER: SALES_NUMBER ? 'set' : 'missing' });

  if (step === 'choice') {
    const next = absUrl(context, '/sales', { step: 'choice_handle', from });
    const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 6, action: next, method: 'POST' });
    say(g, "To receive a text link to our website for product information, press 1. To speak with Jeff in sales, press 2.");
    return callback(null, twiml);
  }

  if (step === 'choice_handle') {
    if (digits === '1') {
      const url = absUrl(context, '/sales', { step: 'confirm', from });
      const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 6, action: url, method: 'POST' });
      say(g, `Please confirm the mobile number to receive the text. Press 1 to use your number ending in ${last4(from)}, or press 2 to enter a new 10-digit mobile number.`);
      return callback(null, twiml);
    } else if (digits === '2') {
      if (SALES_NUMBER) {
        log('decision', { route: 'dial_sales', to: SALES_NUMBER, callerId_used: CALLER_ID || from || undefined });
        // NEW: say before transfer
        say(twiml, "Okay, let me transfer you to Jeff now.");
        const d = twiml.dial({ callerId: CALLER_ID || from || undefined, timeout: 20 });
        d.number(SALES_NUMBER);
        return callback(null, twiml);
      }
      log('decision', { route: 'sales_number_missing' });
      say(twiml, "Sorry, connecting you to sales is not configured yet. Please call us back if you need anything. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    } else {
      const next = absUrl(context, '/sales', { step: 'choice_handle', from });
      if (nudgeOrBye(twiml, "To receive a text link, press 1. To speak with Jeff in sales, press 2.", next)) return callback(null, twiml);
      return callback(null, twiml);
    }
  }

  if (step === 'confirm') {
    if (digits === '1') {
      const client = context.getTwilioClient();
      const to = from;
      const body = `Here is the link ${WEBSITE_URL} to the Cash In Time website you requested.`;
      log('decision', { sms_to: to, via: 'caller' });
      await safeSms(client, to, body);
      say(twiml, "Okay, I've sent you the link by text. Please take a moment to explore our website. If you have any questions, feel free to call us back, and you can speak directly with Jeff. Thanks for calling ATM support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    } else if (digits === '2') {
      const url = absUrl(context, '/sales', { step: 'collect_new', from });
      const g = twiml.gather({ input: 'dtmf', numDigits: 10, timeout: 12, action: url, method: 'POST' });
      say(g, "Please enter the 10-digit mobile number now.");
      return callback(null, twiml);
    } else {
      const next = absUrl(context, '/sales', { step: 'confirm', from });
      if (nudgeOrBye(twiml, `Please confirm the mobile number to receive the text. Press 1 to use your number ending in ${last4(from)}, or press 2 to enter a new 10-digit mobile number.`, next)) return callback(null, twiml);
      return callback(null, twiml);
    }
  }

  if (step === 'collect_new') {
    const entered = (event.Digits || '').replace(/\D/g, '');
    const to = normalizeE164(entered);
    if (!entered || entered.length !== 10 || !to) {
      const next = absUrl(context, '/sales', { step: 'collect_new', from });
      if (nudgeOrBye(twiml, "That didn't look like 10 digits. Please enter the 10-digit mobile number now.", next)) return callback(null, twiml);
      return callback(null, twiml);
    }
    const client = context.getTwilioClient();
    const body = `Here is the link ${WEBSITE_URL} to the Cash In Time website you requested.`;
    log('decision', { sms_to: to, via: 'entered' });
    await safeSms(client, to, body);
    say(twiml, "Okay, I've sent you the link by text. Please take a moment to explore our website. If you have any questions, feel free to call us back, and you can speak directly with Jeff. Thanks for calling ATM support. Goodbye.");
    twiml.hangup();
    return callback(null, twiml);
  }

  const redirectUrl = absUrl(context, '/sales', { step: 'choice', from });
  twiml.redirect(redirectUrl);
  return callback(null, twiml);
};
