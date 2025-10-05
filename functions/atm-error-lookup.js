/**
 * Option 2: ATM Error Lookup
 *
 * Flow:
 *  - step=collect  -> ask for error code (DTMF), one nudge then goodbye
 *  - step=match    -> speak summary; if video exists for the code, mention it.
 *                     Gather(1): "1" => step=sms, "2" => goodbye (skip SMS)
 *  - step=sms      -> choose where to send (caller vs 10 digits)
 *  - step=sms_choice -> "1" send to caller, "2" prompt for 10 digits (sms_set)
 *  - step=sms_set  -> accept 10 digits, send, goodbye
 *
 * Env: MESSAGING_SERVICE_SID (preferred), SMS_FROM (fallback)
 */

const VOICE = { voice: 'Polly.Joanna-Neural', language: 'en-US' };
const LOG_PREFIX = '[atm-error-lookup]';

function say(twiml, text) { twiml.say(VOICE, text); }

function goodbye(twiml, text) {
  say(twiml, text || "Okay, call us back if you can’t resolve the issue and we can have a technician call you back. Thanks for calling A T M support. Goodbye.");
  twiml.hangup();
}

function nudgeOrGoodbye(twiml, url, n) {
  const count = Number(n || 0);
  if (count >= 1) return goodbye(twiml);
  twiml.redirect({ method: 'POST' }, `${url}${url.includes('?') ? '&' : '?'}n=${count + 1}`);
}

function last4(num) {
  const d = (num || '').replace(/\D/g, '');
  return d.slice(-4) || 'xxxx';
}

async function sendSms(context, client, to, body) {
  const params = { to, body };
  if (context.MESSAGING_SERVICE_SID) params.messagingServiceSid = context.MESSAGING_SERVICE_SID;
  else if (context.SMS_FROM) params.from = context.SMS_FROM;
  return client.messages.create(params);
}

// --- Minimal embedded error records (asset is preferred if present)
function embeddedErrorMap() {
  return {
    D1700: {
      title: 'Cash dispenser pick issue.',
      steps: [
        'Check for jammed notes in the pick unit.',
        'Reseat the cassette and close it firmly.',
        'Power-cycle the terminal if needed.'
      ]
    },
    D1701: {
      title: 'Cash dispenser pick error.',
      steps: [
        'Check for jammed notes in the pick unit.',
        'Reseat the cassette and close it firmly.',
        'Power-cycle the terminal if needed.'
      ]
    },
    D0004: {
      title: 'E R R O R in modem data.',
      steps: [
        'No cash was dispensed; screen or receipt indicate system unavailable.',
        'Could be a bad or loose modem — reseat or replace the modem.',
        'Contact support if the issue persists.'
      ]
    },
    D20002: {
      title: 'Low Cash.',
      steps: [
        'Low-cash warning opens near 75 bills when enabled.',
        'If this A T M is usually stocked low, consider disabling the warning.',
        'Refill the cassette or adjust Transaction Setup as needed.'
      ]
    }
  };
}

// Optional how-to videos per error
const VIDEO_MAP = {
  D1700: 'https://youtu.be/si_poPA9sHk?si=PxdGpAGeU7lSoak2'
};

function tryLoadAssetMap() {
  try {
    const assets = Runtime.getAssets ? Runtime.getAssets() : {};
    const a = assets['/private/error_codes.min.json'] || assets['/private/error_codes.json'];
    if (a) {
      const json = JSON.parse(a.open().toString('utf8'));
      return json; // shape: { D1700:{title,steps[]}, ... }
    }
  } catch (e) {
    console.log(LOG_PREFIX, 'asset load failed; using embedded', e && e.message);
  }
  return null;
}

// Turn keypad entry into canonical D-code
function toCanonical(digits) {
  const s = String(digits || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    if (s[0] === '3') return 'D' + s.slice(1).padStart(4, '0'); // “3 for D” style
    if (s.length === 4 || s.length === 5) return 'D' + s;
  }
  if (/^D\d{4,5}$/i.test(s)) return s.toUpperCase();
  return null;
}

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();
  const twiml = new Twilio.twiml.VoiceResponse();
  const step = (event.step || 'collect').trim();
  const n = event.n;

  console.log(LOG_PREFIX, 'step', { step, from: event.From || '', digits: event.Digits || '' });

  const map = tryLoadAssetMap() || embeddedErrorMap();

  try {
    // step=collect
    if (step === 'collect') {
      const g = twiml.gather({
        method: 'POST',
        input: 'dtmf',
        finishOnKey: '#',
        timeout: 10,
        action: `/atm-error-lookup?step=match`,
        actionOnEmptyResult: true,
      });
      say(g, "Okay, please enter your error code using your phone's keypad, then press the pound sign.");
      say(g, "For example, for the error code D 1 7 0 0, you would press the number 3 for the letter D, followed by 1, 7, 0, 0. Enter your error code now, then press the pound sign.");
      if (n) { goodbye(twiml); return callback(null, twiml); }
      twiml.redirect({ method: 'POST' }, `/atm-error-lookup?step=collect&n=1`);
      return callback(null, twiml);
    }

    // step=match
    if (step === 'match') {
      const canonical = toCanonical(event.Digits);
      const rec = canonical && map[canonical];
      if (!rec) {
        say(twiml, "I could not find that error code. I will connect you with a technician.");
        twiml.redirect({ method: 'POST' }, `/tech-callback?step=start&reason=error_not_found&code=${encodeURIComponent(event.Digits || '')}`);
        return callback(null, twiml);
      }

      const spelled = canonical.split('').join(', ');
      say(twiml, `I found your error code ${spelled}. ${rec.title}`);
      if (Array.isArray(rec.steps)) {
        say(twiml, "Here is a brief summary of the steps:");
        rec.steps.forEach(s => say(twiml, s));
      }

      const hasVideo = Boolean(VIDEO_MAP[canonical]);
      const g = twiml.gather({
        method: 'POST',
        input: 'dtmf',
        numDigits: 1,
        timeout: 5,
        action: `/atm-error-lookup?step=sms&code=${encodeURIComponent(canonical)}`,
        actionOnEmptyResult: true,
      });
      if (hasVideo) {
        say(g, "I see there is a how to fix video available for this error. Press 1 if you want me to text you the video link along with the troubleshooting steps. Or press 2 to skip.");
      } else {
        say(g, "Press 1 if you want me to text you these troubleshooting steps. Or press 2 to skip.");
      }

      if (n) { goodbye(twiml); return callback(null, twiml); }
      twiml.redirect({ method: 'POST' }, `/atm-error-lookup?step=match&Digits=${encodeURIComponent(event.Digits || '')}&n=1`);
      return callback(null, twiml);
    }

    // step=sms (1=proceed to choice, 2=goodbye)
    if (step === 'sms') {
      const code = (event.code || '').toUpperCase();
      const d = (event.Digits || '').trim();

      if (d === '1') {
        const g = twiml.gather({
          method: 'POST',
          input: 'dtmf',
          numDigits: 1,
          timeout: 7,
          action: `/atm-error-lookup?step=sms_choice&code=${encodeURIComponent(code)}&from=${encodeURIComponent(event.From || '')}`,
          actionOnEmptyResult: true,
        });
        say(g, `Press 1 to use your number ending in ${last4(event.From)}, or press 2 to enter a different 10 digit mobile number.`);
        if (n) { goodbye(twiml); return callback(null, twiml); }
        twiml.redirect({ method: 'POST' }, `/atm-error-lookup?step=sms&code=${encodeURIComponent(code)}&n=1`);
        return callback(null, twiml);
      }

      if (d === '2') { goodbye(twiml); return callback(null, twiml); }

      nudgeOrGoodbye(twiml, `/atm-error-lookup?step=sms&code=${encodeURIComponent(code)}`, n);
      return callback(null, twiml);
    }

    // step=sms_choice
    if (step === 'sms_choice') {
      const code = (event.code || '').toUpperCase();
      const d = (event.Digits || '').trim();

      if (d === '1') {
        if (!event.From) { goodbye(twiml); return callback(null, twiml); }
        const body = buildSmsBody(code, map);
        await sendSms(context, client, event.From, body);
        say(twiml, "Alright, I just sent you a text with some steps to resolve your error. If you are unsuccessful, please call us back and choose option 4 to have a technician call you back. Thanks for calling A T M support. Goodbye.");
        twiml.hangup();
        return callback(null, twiml);
      }

      if (d === '2') {
        const g = twiml.gather({
          method: 'POST',
          input: 'dtmf',
          numDigits: 10,
          timeout: 8,
          action: `/atm-error-lookup?step=sms_set&code=${encodeURIComponent(code)}`,
          actionOnEmptyResult: true,
        });
        say(g, "Please enter the 10 digit mobile number.");
        if (n) { goodbye(twiml); return callback(null, twiml); }
        twiml.redirect({ method: 'POST' }, `/atm-error-lookup?step=sms_choice&code=${encodeURIComponent(code)}&from=${encodeURIComponent(event.From || '')}&n=1`);
        return callback(null, twiml);
      }

      nudgeOrGoodbye(twiml, `/atm-error-lookup?step=sms_choice&code=${encodeURIComponent(code)}&from=${encodeURIComponent(event.From || '')}`, n);
      return callback(null, twiml);
    }

    // step=sms_set
    if (step === 'sms_set') {
      const code = (event.code || '').toUpperCase();
      const digits = (event.Digits || '').replace(/\D/g, '');
      if (digits.length === 10) {
        const to = `+1${digits}`;
        const body = buildSmsBody(code, map);
        await sendSms(context, client, to, body);
        say(twiml, "Alright, I just sent you a text with some steps to resolve your error. If you are unsuccessful, please call us back and choose option 4 to have a technician call you back. Thanks for calling A T M support. Goodbye.");
        twiml.hangup();
        return callback(null, twiml);
      }
      const g = twiml.gather({
        method: 'POST',
        input: 'dtmf',
        numDigits: 10,
        timeout: 8,
        action: `/atm-error-lookup?step=sms_set&code=${encodeURIComponent(code)}`,
        actionOnEmptyResult: true,
      });
      say(g, "Sorry, please enter a valid 10 digit mobile number.");
      if (n) { goodbye(twiml); return callback(null, twiml); }
      twiml.redirect({ method: 'POST' }, `/atm-error-lookup?step=sms_set&code=${encodeURIComponent(code)}&n=1`);
      return callback(null, twiml);
    }

    // fallback
    nudgeOrGoodbye(twiml, `/atm-error-lookup?step=collect`, n);
    return callback(null, twiml);

  } catch (err) {
    console.error(LOG_PREFIX, 'error', err);
    goodbye(twiml);
    return callback(null, twiml);
  }
};

function buildSmsBody(code, map) {
  const rec = map[code];
  const lines = [`Error ${code}: ${rec?.title || ''}`];
  if (Array.isArray(rec?.steps) && rec.steps.length) {
    lines.push('Steps:');
    rec.steps.forEach(s => lines.push(`- ${s}`));
  }
  if (VIDEO_MAP[code]) {
    lines.push('');
    lines.push(`Video: ${VIDEO_MAP[code]}`);
  }
  return lines.join('\n');
}
