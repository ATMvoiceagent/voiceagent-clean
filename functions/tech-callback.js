// Option 4: Tech callback (one-nudge rule everywhere)
exports.handler = async (context, event, callback) => {
  const twiml = new (require('twilio').twiml.VoiceResponse)();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';
  const GEO_URL = context.GEO_URL || 'https://citvan-clean-6447-ui.twil.io/assist.html?mode=geo';

  const n = parseInt(event.n || '0', 10);
  const step = event.step || 'start';

  // helper to end politely
  const sayBye = () => {
    twiml.say({ voice }, "Okay, call us back if you would like more information. Goodbye.");
    twiml.hangup();
  };

  if (step === 'start') {
    const g = twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      action: '/tech-callback?step=name'
    });
    g.say({ voice, language: 'en-US' },
      "Let’s get a bit of information so I can get a technician to call you back. Please say your first name.");
    if (!event.SpeechResult && n === 1) { return callback(null, (sayBye(), twiml)); }
    if (!event.SpeechResult) {
      twiml.redirect({ method: 'POST' }, '/tech-callback?step=start&n=1');
    }
    return callback(null, twiml);
  }

  if (step === 'name') {
    const name = (event.SpeechResult || '').trim();
    const from = event.From || '';
    const last4 = (from.match(/\d/g) || []).slice(-4).join('');
    if (!name) {
      if (n === 1) { return callback(null, (sayBye(), twiml)); }
      const g = twiml.gather({
        method: 'POST',
        input: 'speech',
        timeout: 7,
        speechTimeout: 'auto',
        action: '/tech-callback?step=name&n=1'
      });
      g.say({ voice }, "Sorry, can you say your first name again?");
      return callback(null, twiml);
    }
    const g = twiml.gather({
      method: 'POST',
      input: 'dtmf',
      numDigits: 1,
      timeout: 8,
      action: `/tech-callback?step=choice&name=${encodeURIComponent(name)}`
    });
    g.say({ voice, language: 'en-US' },
      `Thanks, ${name}. Did you want the tech to call you back on the number ending in ${last4}? Press 1 for yes or 2 to enter a different 10 digit number.`);
    return callback(null, twiml);
  }

  if (step === 'choice') {
    const d = String(event.Digits || '');
    const name = event.name || 'there';
    const from = event.From || '';
    if (!d) {
      if (n === 1) { return callback(null, (sayBye(), twiml)); }
      twiml.redirect({ method: 'POST' }, `/tech-callback?step=choice&name=${encodeURIComponent(name)}&n=1`);
      return callback(null, twiml);
    }
    if (d === '2') {
      const g = twiml.gather({
        method: 'POST',
        input: 'dtmf',
        numDigits: 10,
        timeout: 8,
        action: `/tech-callback?step=set_number&name=${encodeURIComponent(name)}`
      });
      g.say({ voice }, "Please enter the 10 digit mobile number.");
      return callback(null, twiml);
    }
    // default: use From
    const g = twiml.gather({
      method: 'POST',
      input: 'dtmf',
      numDigits: 1,
      timeout: 8,
      action: `/tech-callback?step=geo_offer&name=${encodeURIComponent(name)}&to=${encodeURIComponent(from)}`
    });
    g.say({ voice }, "In a few brief words, what are you calling about? If you're currently near the A T M, I can send you a secure link to share your location. Press 1 to receive the link now, or press 2 to skip.");
    return callback(null, twiml);
  }

  if (step === 'set_number') {
    const name = event.name || 'there';
    const digits = String(event.Digits || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      if (n === 1) { return callback(null, (sayBye(), twiml)); }
      const g = twiml.gather({
        method: 'POST',
        input: 'dtmf',
        numDigits: 10,
        timeout: 8,
        action: `/tech-callback?step=set_number&name=${encodeURIComponent(name)}&n=1`
      });
      g.say({ voice }, "Sorry, that didn't look like 10 digits. Please re-enter the mobile number.");
      return callback(null, twiml);
    }
    const to = `+1${digits}`;
    const g = twiml.gather({
      method: 'POST',
      input: 'dtmf',
      numDigits: 1,
      timeout: 8,
      action: `/tech-callback?step=geo_offer&name=${encodeURIComponent(name)}&to=${encodeURIComponent(to)}`
    });
    g.say({ voice }, "Thanks. If you're currently near the A T M, I can send you a secure link to share your location. Press 1 to receive the link now, or press 2 to skip.");
    return callback(null, twiml);
  }

  if (step === 'geo_offer') {
    const d = String(event.Digits || '');
    const to = event.to || event.From || '';
    if (!d) {
      if (n === 1) { return callback(null, (sayBye(), twiml)); }
      twiml.redirect({ method: 'POST' }, `/tech-callback?step=geo_offer&to=${encodeURIComponent(to)}&n=1`);
      return callback(null, twiml);
    }

    if (d === '1') {
      // send geo link SMS
      const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
      const body = "Please click the link to share your ATM location.\n" + GEO_URL;
      const msg = { to };
      if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
      else if (context.SMS_FROM) msg.from = context.SMS_FROM;
      msg.body = body;
      try { await client.messages.create(msg); } catch(e) { console.log('[tech-callback] sms err', String(e)); }
      twiml.say({ voice }, "Awesome! I've just sent you a text with the link. Please tap it to share your location, and a technician will call you back shortly. Thank you for contacting A T M support. Goodbye!");
      twiml.hangup();
      return callback(null, twiml);
    }

    // d === '2' skip
    twiml.say({ voice }, "Got it. A technician will call you back shortly. Thank you for contacting A T M support. Goodbye!");
    twiml.hangup();
    return callback(null, twiml);
  }

  // fallback
  twiml.redirect({ method: 'POST' }, '/tech-callback?step=start');
  return callback(null, twiml);
};
