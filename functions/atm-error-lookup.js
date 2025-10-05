exports.handler = async (context, event, callback) => {
  const { twiml: { VoiceResponse } } = require('twilio');
  const twiml = new VoiceResponse();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  const hdrs  = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'') || 'example.twil.io';
  const base  = `${proto}://${host}`;
  const _nudge = require(Runtime.getFunctions()["_nudge-atm"].path);

  const goodbye = () => {
    twiml.say({ voice }, 'Okay, call us back if you would like more information. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };

  const CATALOG = {
    D1700: { vendor:'Hyosung', title:'Cash dispenser pick issue', steps:[
      'Check for jammed notes in the pick unit.',
      'Reseat cassette and close firmly.',
      'Power-cycle the terminal if needed.'
    ]},
    D1701: { vendor:'Hyosung', title:'Cash dispenser pick error', steps:[
      'Check for jammed notes in the pick unit.',
      'Reseat cassette and close firmly.',
      'Power-cycle the terminal if needed.'
    ]},
    D0004: { vendor:'Triton', title:'ERROR IN MODEM DATA', steps:[
      'No cash was dispensed; screen/receipt indicate system unavailable.',
      'Could be a bad or loose modem — reseat or replace the modem.',
      'Contact support if the issue persists.'
    ]},
    D1704: { vendor:'Genmega', title:'Modem connection error', steps:[
      'Phone line connected to ATM may not support data communication.',
      'In-line filter may help. Check for EMI sources.',
      'Verify programming (Dual Master Key, Host Processor Mode).'
    ]},
    D20002:{ vendor:'Hantle', title:'Low Cash', steps:[
      'Low-cash warning opens near 75 bills when enabled.',
      'If typically stocked low, consider disabling the warning.',
      'Refill the cassette or adjust Transaction Setup as needed.'
    ]},
  };

  const saySpell = (s) => s.split('').map(ch => (/\d/.test(ch) ? ch : ch.toUpperCase())).join(', ');

  const mapDigitsToCode = (digits) => {
    const d = String(digits || '').replace(/[^0-9]/g,'');
    if (!d) return null;
    if (d.length === 1) return `D000${d}`; // 4 -> D0004
    return `D${d}`;
  };

  const normalizeToCatalog = (canon) => {
    if (CATALOG[canon]) return canon;
    if (canon === 'D31701') return 'D1701';
    if (canon === 'D31704') return 'D1704';
    return null;
  };

  const step = event.step || 'collect';

  // --- Collect (DTMF + #) ---
  if (step === 'collect') {
    const g = twiml.gather({
      method:'POST', input:'dtmf', finishOnKey:'#', timeout:10,
      action:`${base}/atm-error-lookup?step=match`
    });
    g.say({ voice }, "Okay, please enter your error code using your phone's keypad, then press the pound sign.");
    g.say({ voice }, 'For example, for the error code D 1 7 0 0, you would press the number 3 for the letter D, followed by 1, 7, 0, 0. Enter your error code now, then press the pound sign.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=collect_n1`);
    return callback(null, twiml);
  }

  if (step === 'collect_n1') {
    const g = twiml.gather({
      method:'POST', input:'dtmf', finishOnKey:'#', timeout:6,
      action:`${base}/atm-error-lookup?step=collect_timeout`
    });
    g.say({ voice }, 'Please enter the code now, then press the pound sign.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=collect_timeout`);
    return callback(null, twiml);
  }

  if (step === 'collect_timeout') return goodbye();

  if (step === 'match') {
    const digits = event.Digits || '';
    const canon  = mapDigitsToCode(digits);
    const key    = canon ? normalizeToCatalog(canon) : null;

    if (!key || !CATALOG[key]) {
      twiml.say({ voice }, 'I could not find that error code. I will connect you with a technician.');
      twiml.redirect({ method:'POST' }, `${base}/tech-callback?step=start&reason=error_not_found&code=${encodeURIComponent(digits)}`);
      return callback(null, twiml);
    }

    const item = CATALOG[key];
    twiml.say({ voice }, `I found your error code ${saySpell(key)}. ${item.title}.`);
    if (Array.isArray(item.steps) && item.steps.length) {
      twiml.say({ voice }, 'Here is a brief summary of the steps:');
      for (const s of item.steps) twiml.say({ voice }, s);
    }

    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:1, timeout:5,
      action:`${base}/atm-error-lookup?step=sms&code=${encodeURIComponent(key)}`
    });
    g.say({ voice }, 'Press 1 if you want me to text you these troubleshooting steps.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_n1&code=${encodeURIComponent(key)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_n1') {
    const code = event.code || '';
    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:1, timeout:5,
      action:`${base}/atm-error-lookup?step=sms_timeout&code=${encodeURIComponent(code)}`
    });
    g.say({ voice }, 'Please press 1 now if you want the text.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_timeout&code=${encodeURIComponent(code)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_timeout') return goodbye();

  if (step === 'sms') {
    const code = event.code || '';
    const item = CATALOG[code];
    if (!item) {
      twiml.say({ voice }, 'I’m having trouble with your request. I’ll connect you to a technician.');
      twiml.redirect({ method:'POST' }, `${base}/tech-callback?step=start&reason=error_sms_miss`);
      return callback(null, twiml);
    }

    const from = event.From || '';
    const last4 = (from.match(/\d/g) || []).slice(-4).join('');
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:7,
      action:`${base}/atm-error-lookup?step=sms_choice&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}`
    });
    g.say({ voice }, `Do you want me to text the steps to the number ending in ${last4}? Press 1 to use this number, or 2 to enter a different 10 digit number.`);
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_choice_n1&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_choice_n1') {
    const code = event.code || '';
    const from = event.from || event.From || '';
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:6,
      action:`${base}/atm-error-lookup?step=sms_choice_timeout&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}`
    });
    g.say({ voice }, 'Please choose now.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_choice_timeout&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_choice_timeout') return goodbye();

  if (step === 'sms_choice') {
    const code = event.code || '';
    const item = CATALOG[code];
    if (!item) {
      twiml.say({ voice }, 'I’m having trouble with your request. I’ll connect you to a technician.');
      twiml.redirect({ method:'POST' }, `${base}/tech-callback?step=start&reason=error_sms_choice_miss`);
      return callback(null, twiml);
    }

    const d = String(event.Digits || '').trim();
    if (d === '2') {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:10, timeout:8,
        action:`${base}/atm-error-lookup?step=sms_set&code=${encodeURIComponent(code)}`
      });
      g.say({ voice }, 'Please enter the 10 digit mobile number.');
      twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_set_n1&code=${encodeURIComponent(code)}`);
      return callback(null, twiml);
    }

    // default: use From
    const target = event.from || event.From || '';
    await sendStepsSms(context, target, code, item);
    twiml.say({ voice }, 'Alright, I just sent you a text with some steps to resolve your error. If you are unsuccessful, please call us back and choose option 4 to have a technician call you back. Thanks for calling A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  if (step === 'sms_set_n1') {
    const code = event.code || '';
    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:10, timeout:6,
      action:`${base}/atm-error-lookup?step=sms_set&code=${encodeURIComponent(code)}`
    });
    g.say({ voice }, 'Please enter the 10 digit mobile number now.');
    twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=sms_set_timeout`);
    return callback(null, twiml);
  }

  if (step === 'sms_set_timeout') return goodbye();

  if (step === 'sms_set') {
    const code = event.code || '';
    const item = CATALOG[code];
    const digits = String(event.Digits || '').replace(/\D/g, '');
    const to = digits.length === 10 ? `+1${digits}` : '';

    if (!item || !to) {
      twiml.say({ voice }, 'I’m having trouble with your request. I’ll connect you to a technician.');
      twiml.redirect({ method:'POST' }, `${base}/tech-callback?step=start&reason=error_sms_set_miss`);
      return callback(null, twiml);
    }

    await sendStepsSms(context, to, code, item);
    twiml.say({ voice }, 'Alright, I just sent you a text with some steps to resolve your error. If you are unsuccessful, please call us back and choose option 4 to have a technician call you back. Thanks for calling A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  // default
  twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=collect`);
  return callback(null, twiml);
};

// --- helper ---
async function sendStepsSms(context, to, code, item) {
  if (!to) return;
  const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const steps = (item.steps || []).map((s) => `• ${s}`).join('\n');
  const body =
    `ATM Error ${code} — ${item.title}\n` +
    (item.vendor ? `Vendor: ${item.vendor}\n` : '') +
    (steps ? `\nSteps:\n${steps}\n` : '');
  const msg = { to, body };
  if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
  else if (context.SMS_FROM) msg.from = context.SMS_FROM;
  try { await client.messages.create(msg); } catch (_e) {}
}
