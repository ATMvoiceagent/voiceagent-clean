exports.handler = async (context, event, callback) => {
  const { twiml: { VoiceResponse } } = require('twilio');
  const twiml = new VoiceResponse();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  const hdrs  = event.headers || {};
  const proto = hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https';
  const host  = hdrs.host || hdrs.Host || (context.DOMAIN_NAME || '').replace(/^https?:\/\//,'');
  const base  = `${proto}://${host}`;

  const goodbye = () => {
    twiml.say({ voice }, 'Okay, call us back if you would like more information. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };

  const step = event.step || 'menu';

  if (step === 'menu') {
    const g = twiml.gather({
      method: 'POST', timeout: 7, input: 'speech dtmf', numDigits: 1, speechTimeout: 'auto',
      action: `${base}/main-menu?step=choice`, actionOnEmptyResult: true
    });
    g.say({ voice, language: 'en-US' },
      "Thank you for contacting ATM Support. If you have questions about pricing and product information, or you're looking to purchase or place an A T M, press 1. If you have an error code on your A T M screen, press 2. If you're experiencing an issue such as a stuck card or not receiving cash, press 3. Or to have a technician call you back, press 4. Please make your selection now. You can press 0 at any time to start over."
    );
    twiml.redirect({ method: 'POST' }, `${base}/main-menu?step=menu_n1`);
    return callback(null, twiml);
  }

  if (step === 'menu_n1') {
    const g = twiml.gather({
      method:'POST', input:'speech dtmf', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/main-menu?step=menu_timeout`
    });
    g.say({ voice }, 'Please make a selection now.');
    twiml.redirect({ method:'POST' }, `${base}/main-menu?step=menu_timeout`);
    return callback(null, twiml);
  }

  if (step === 'menu_timeout') return goodbye();

  if (step === 'choice') {
    const d = String(event.Digits || '').trim();
    if (d === '1') return twiml.redirect({ method:'POST' }, `${base}/sales?step=menu`), callback(null, twiml);
    if (d === '2') return twiml.redirect({ method:'POST' }, `${base}/atm-error-lookup?step=collect`), callback(null, twiml);
    if (d === '3') return twiml.redirect({ method:'POST' }, `${base}/issues-mini?step=start`), callback(null, twiml);
    if (d === '4') return twiml.redirect({ method:'POST' }, `${base}/tech-callback?step=start`), callback(null, twiml);
    if (d === '0') return twiml.redirect({ method:'POST' }, `${base}/main-menu?step=menu`), callback(null, twiml);

    // invalid → single nudge then goodbye
    const g = twiml.gather({
      method:'POST', input:'speech dtmf', numDigits:1, timeout:6, speechTimeout:'auto',
      action:`${base}/main-menu?step=choice_timeout`
    });
    g.say({ voice }, 'Sorry, I didn’t get that. Please choose 1, 2, 3 or 4.');
    twiml.redirect({ method:'POST' }, `${base}/main-menu?step=choice_timeout`);
    return callback(null, twiml);
  }

  if (step === 'choice_timeout') return goodbye();

  // default
  twiml.redirect({ method:'POST' }, `${base}/main-menu?step=menu`);
  return callback(null, twiml);
};
