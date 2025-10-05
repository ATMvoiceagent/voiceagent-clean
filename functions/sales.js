exports.handler = async (context, event, callback) => {
  const { twiml: { VoiceResponse } } = require('twilio');
  const twiml = new VoiceResponse();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  // dynamic base url
  const hdrs  = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'');
  const base  = `${proto}://${host}`;

  const log = (msg, extra={}) => console.log('[sales]', msg, extra);
  const goodbye = () => {
    twiml.say({ voice }, 'Okay, call us back if you would like more information. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };

  const sendSiteLink = async (to) => {
    if (!to) return;
    const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    const url = context.WEBSITE_URL || 'https://cashintime.ca';
    const msg = { to, body: `Product info: ${url}` };
    if (context.MESSAGING_SERVICE_SID) msg.messagingServiceSid = context.MESSAGING_SERVICE_SID;
    else if (context.SMS_FROM) msg.from = context.SMS_FROM;
    try { await client.messages.create(msg); } catch (e) {}
  };

  const callJeff = () => {
    const dial = twiml.dial({ timeout: 25, callerId: context.CALLER_ID || event.From || undefined });
    dial.number('+16043295286'); // Jeff
    return callback(null, twiml);
  };

  const step = event.step || 'menu';
  const homeUrl = event.homeUrl || '/main-menu';

  // ---------- MENU ----------
  if (step === 'menu') {
    log('menu', { from: event.From || '', digits: String(event.Digits||'') });
    const g = twiml.gather({
      method: 'POST', input: 'dtmf speech', numDigits: 1, timeout: 7, speechTimeout: 'auto',
      action: `${base}/sales?step=choice&homeUrl=${encodeURIComponent(homeUrl)}`,
      actionOnEmptyResult: true
    });
    g.say({ voice, language: 'en-US' },
      'To receive a text link to our website for product information, press 1. To speak with Jeff in sales, press 2.'
    );
    // one nudge then timeout (no actionOnEmptyResult in n1)
    twiml.redirect({ method: 'POST' }, `${base}/sales?step=menu_n1&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'menu_n1') {
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/sales?step=menu_timeout&homeUrl=${encodeURIComponent(homeUrl)}`
    });
    g.say({ voice }, 'Please make a selection now.');
    // if still no input, Twilio will hit Redirect below
    twiml.redirect({ method:'POST' }, `${base}/sales?step=menu_timeout&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'menu_timeout') return goodbye();

  // ---------- CHOICE ----------
  if (step === 'choice') {
    const d = String(event.Digits || '').trim();
    log('choice', { from: event.From || '', digits: d });

    if (d === '1') {
      const from = event.From || '';
      const last4 = (from.match(/\d/g) || []).slice(-4).join('');
      const g = twiml.gather({
        method:'POST', input:'dtmf speech', numDigits:1, timeout:7, speechTimeout:'auto',
        action:`${base}/sales?step=sms_confirm&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`,
        actionOnEmptyResult: true
      });
      g.say({ voice }, `Please confirm the mobile number to receive the text. Press 1 to use your number ending in ${last4}, or press 2 to enter a new 10 digit mobile number.`);
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_confirm_n1&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    if (d === '2') return callJeff();

    // invalid → single nudge, then goodbye
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/sales?step=choice_timeout&homeUrl=${encodeURIComponent(homeUrl)}`
    });
    g.say({ voice }, 'Sorry, I didn’t get that. Please press 1 for a text link or 2 to speak with sales.');
    twiml.redirect({ method:'POST' }, `${base}/sales?step=choice_timeout&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'choice_timeout') return goodbye();

  // ---------- SMS CONFIRM ----------
  if (step === 'sms_confirm') {
    const d = String(event.Digits || '').trim();
    const from = event.from || event.From || '';
    log('sms_confirm', { from, digits: d, stage: 'main' });

    if (!d) {
      // no input → go to n1
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_confirm_n1&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    if (d === '2') {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:10, timeout:8,
        action:`${base}/sales?step=sms_set&homeUrl=${encodeURIComponent(homeUrl)}`
      });
      g.say({ voice }, 'Please enter the 10 digit mobile number.');
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_set_n1&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    // default: use the caller's number
    await sendSiteLink(from);
    log('sms sent', { to: from });
    twiml.say({ voice }, 'I have sent you the link via text. Thanks for contacting A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  if (step === 'sms_confirm_n1') {
    const from = event.from || event.From || '';
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/sales?step=sms_confirm_timeout&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`
    });
    g.say({ voice }, 'Please choose now.');
    twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_confirm_timeout&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_confirm_timeout') return goodbye();

  // ---------- SMS CHOICE (legacy) ----------
  if (step === 'sms_choice') {
    const d = String(event.Digits || '').trim();
    const from = event.from || event.From || '';
    log('sms_choice', { from, digits: d, stage: 'main' });

    if (!d) {
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_choice_n1&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    if (d === '2') {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:10, timeout:8,
        action:`${base}/sales?step=sms_set&homeUrl=${encodeURIComponent(homeUrl)}`
      });
      g.say({ voice }, 'Please enter the 10 digit mobile number.');
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_set_n1&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    await sendSiteLink(from);
    log('sms sent', { to: from });
    twiml.say({ voice }, 'I have sent you the link via text. Thanks for contacting A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  if (step === 'sms_choice_n1') {
    const from = event.from || event.From || '';
    const g = twiml.gather({
      method:'POST', input:'dtmf speech', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/sales?step=sms_choice_timeout&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`
    });
    g.say({ voice }, 'Please choose now.');
    twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_choice_timeout&from=${encodeURIComponent(from)}&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_choice_timeout') return goodbye();

  // ---------- SMS SET (enter 10 digits) ----------
  if (step === 'sms_set') {
    const digits = String(event.Digits || '').replace(/\D/g,'');
    log('sms_set', { digits, stage: 'main' });

    if (!digits) {
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_set_n1&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    if (digits.length !== 10) {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:10, timeout:8,
        action:`${base}/sales?step=sms_set&homeUrl=${encodeURIComponent(homeUrl)}`
      });
      g.say({ voice }, 'Please enter the 10 digit mobile number.');
      twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_set_n1&homeUrl=${encodeURIComponent(homeUrl)}`);
      return callback(null, twiml);
    }

    await sendSiteLink(`+1${digits}`);
    log('sms sent', { to: `+1${digits}` });
    twiml.say({ voice }, 'I have sent you the link via text. Thanks for contacting A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  if (step === 'sms_set_n1') {
    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:10, timeout:6,
      action:`${base}/sales?step=sms_set_timeout&homeUrl=${encodeURIComponent(homeUrl)}`
    });
    g.say({ voice }, 'Please enter the 10 digit mobile number now.');
    twiml.redirect({ method:'POST' }, `${base}/sales?step=sms_set_timeout&homeUrl=${encodeURIComponent(homeUrl)}`);
    return callback(null, twiml);
  }

  if (step === 'sms_set_timeout') return goodbye();

  // fallback
  twiml.redirect({ method:'POST' }, `${base}/sales?step=menu&homeUrl=${encodeURIComponent(homeUrl)}`);
  return callback(null, twiml);
};
