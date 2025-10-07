// /atm-error-lookup.js — Option 2: ATM Error Lookup
// Copy tweak: when caller presses 2 (decline SMS), say:
// "No problem. Call us back if you're unable to resolve your issue. Thanks for calling ATM support. Goodbye."
// Everything else unchanged (accept up to 7 digits; post-SMS line branches on hasVideo).

exports.handler = async function (context, event, callback) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;

  // --- ENV
  const SMS_FROM = context.SMS_FROM || context.CALLER_ID || '';

  // --- INPUTS
  const step   = (event.step || 'collect').toString();
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
  function say(r, text) { r.say({ voice: 'Polly.Joanna-Neural', language: 'en-US' }, text); }
  function log(tag, obj) { try { console.log(`[atm-error-lookup] ${JSON.stringify({ step, tag, ...obj })}`); } catch {} }
  function normalizeE164(num) {
    if (!num) return '';
    let d = num.toString().replace(/\D/g, '');
    if (d.length === 10) d = '1' + d;
    if (!d.startsWith('1')) return '';
    return '+' + d;
  }

  // Canonicalize keypad digits to a D-code (supports up to 7 key presses)
  // examples: "31700"→"D1700", "4"→"D0004", "20002"→"D20002", "3200023"→"D200023"
  function toDCode(raw) {
    let d = (raw || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.length >= 5 && d.length <= 7 && d[0] === '3') d = d.slice(1); // leading '3' for 'D'
    if (d.length <= 4) d = d.padStart(4, '0');
    if (d.length > 6)  d = d.slice(-6);
    return 'D' + d;
  }

  // Embedded fallback map (current test set)
  const ERROR_MAP = {
    D1700: {
      title: "Cash Dispenser: Reset/Initialize",
      summary: "This code often clears after a safe reboot. Power-cycle the ATM or perform dispenser reset.",
      steps: [
        "Open the lower door and ensure no notes are jammed.",
        "Power off the ATM for 30 seconds, then power on.",
        "From the operator menu, run Cash Dispenser Reset/Initialize.",
        "Test a $5 withdrawal."
      ],
      video: "https://youtu.be/si_poPA9sHk?si=PxdGpAGeU7lSoak2"
    },
    D1701: {
      title: "Cash Dispenser: Calibrate / Empty Rejects",
      summary: "Clear rejects and re-seat the cassette. Run dispenser reset and try a small test withdrawal.",
      steps: [
        "Pull the cassette and empty reject bin.",
        "Check for torn notes; re-seat cassette firmly.",
        "Run Dispenser Reset/Initialize.",
        "Test a $5 withdrawal."
      ]
    },
    D0004: {
      title: "General Error",
      summary: "Try a safe power-cycle and check all cables. If the error remains, a technician may be required.",
      steps: [
        "Power off the ATM for 30 seconds, then power on.",
        "Check I/O and network cables are firmly connected.",
        "If the error persists, request a technician callback."
      ]
    },
    D20002: {
      title: "Low Cash",
      summary: "Low-cash warning opens near 75 bills when enabled.",
      steps: [
        "If this ATM is usually stocked low, consider disabling the warning.",
        "Refill the cassette or adjust Transaction Setup as needed."
      ]
    }
  };

  // --- START
  const twiml = new VoiceResponse();
  log('request', { From: from, Digits: digits });

  if (step === 'collect') {
    const next = absUrl(context, '/atm-error-lookup', { step: 'match', from });
    const g = twiml.gather({
      input: 'dtmf',
      timeout: 10,
      numDigits: 7,
      finishOnKey: '#',
      action: next,
      method: 'POST',
      actionOnEmptyResult: true
    });
    // keep your live copy here:
    say(g, "Okay, please enter your error code using your phone's keypad, then press the pound sign.");
    say(g, "For example, for the error code D 1 7 0 0, you would press the number 3 for the letter D, followed by 1, 7, 0, 0. Enter your error code now, then press the pound sign.");
    const repromptUrl = absUrl(context, '/atm-error-lookup', { step: 'collect', from });
    twiml.redirect({ method: 'POST' }, repromptUrl + `&n=1`);
    return callback(null, twiml);
  }

  if (step === 'match') {
    const dcode = toDCode(digits);
    log('map', { entered: digits, mapped: dcode });

    if (!dcode || !ERROR_MAP[dcode]) {
      say(twiml, "I could not find that error code. I will connect you with a technician.");
      const url = absUrl(context, '/tech-callback', { step: 'start', reason: 'error_not_found', code: digits });
      twiml.redirect({ method: 'POST' }, url);
      return callback(null, twiml);
    }

    const item = ERROR_MAP[dcode];
    say(twiml, `I found your error code ${spellOutDCode(dcode)} ${item.title}.`);
    say(twiml, "Here is a brief summary of the steps:");
    for (const line of item.steps || []) say(twiml, line);

    const next = absUrl(context, '/atm-error-lookup', { step: 'sms', code: dcode, hasVideo: item.video ? 1 : 0, from });
    const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 5, action: next, method: 'POST', actionOnEmptyResult: true });
    say(g, "Press 1 if you want me to text you these troubleshooting steps. Or press 2 to skip.");
    twiml.redirect({ method: 'POST' }, next + `&n=1`);
    return callback(null, twiml);
  }

  if (step === 'sms') {
    const dcode = (event.code || '').toString();
    const choice = (digits || '').trim();
    const hasVideo = (event.hasVideo || '0') === '1';
    const item = ERROR_MAP[dcode];

    if (!item) {
      say(twiml, "Sorry, that error is no longer available. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    if (choice === '1') {
      // Send SMS with steps (+ video link when available)
      const client = context.getTwilioClient();
      const lines = [
        `${dcode} — ${item.title}`,
        item.summary,
        ...(item.steps || []).map((s) => `• ${s}`),
        hasVideo && item.video ? `Video: ${item.video}` : null
      ].filter(Boolean);
      const body = lines.join('\n');

      try {
        const msg = await client.messages.create({ from: SMS_FROM, to: from, body });
        log('sms', { action: 'sent', sid: msg.sid, to: from, from_used: SMS_FROM, code: dcode });
      } catch (e) {
        log('sms', { action: 'error', to: from, from_used: SMS_FROM, code: dcode, err: e?.message, codeNum: e?.code });
      }

      // Branch closing line on video presence
      if (hasVideo && item.video) {
        say(twiml, "I sent the steps to resolve the issue by text, along with a link to a video that demonstrates how to fix the problem. Please call us back if you're unable to resolve the issue. Thank you for contacting ATM support. Goodbye!");
      } else {
        say(twiml, "I sent the steps to resolve the issue by text. Please call us back if you are unable to resolve the issue. Thanks for calling ATM support. Goodbye.");
      }
      twiml.hangup();
      return callback(null, twiml);
    }

    // >>> UPDATED COPY WHEN DECLINING SMS (press 2)
    say(twiml, "No problem. Call us back if you're unable to resolve your issue. Thanks for calling ATM support. Goodbye.");
    twiml.hangup();
    return callback(null, twiml);
  }

  // Default: go to collect
  const redirectUrl = absUrl(context, '/atm-error-lookup', { step: 'collect', from });
  twiml.redirect(redirectUrl);
  return callback(null, twiml);

  // --- UTIL
  function spellOutDCode(code) {
    return code.split('').join(', ');
  }
};
