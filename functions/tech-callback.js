exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  const voice = 'Polly.Joanna-Neural';
  const client = context.getTwilioClient();

  const SMS_FROM = context.SMS_FROM || '';
  const GEO_URL  = context.GEO_URL  || '';

  const step = (event.step || 'start').toLowerCase();
  const n = Number(event.n || 0);
  const d = (event.Digits || '').trim();
  const from = (event.From || '').trim();
  const name = (event.name || '').trim();
  const cb = (event.cb || '').trim(); // callback number (if different)

  const say = (t) => twiml.say({ voice, language:'en-US' }, t);

  const sendSms = async (to, body) => {
    if (!to || !SMS_FROM) return;
    try { await client.messages.create({ to, from: SMS_FROM, body }); }
    catch(e){ console.log('[tech-callback] sms error', e.message); }
  };

  const goodbye = () => {
    say('Thank you for contacting A T M support. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };

  const noProblemThenGoodbye = () => {
    say('No problem. If you need further assistance, please call us back and a technician will return your call.');
    return goodbye();
  };

  if (step === 'start') {
    const g = twiml.gather({
      method:'POST', input:'speech', timeout:7, speechTimeout:'auto',
      action:'/tech-callback?step=name', actionOnEmptyResult:true
    });
    g.say({ voice }, 'Let’s get a bit of information so I can get a technician to call you back. Please say your first name.');
    if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=name&n=${n+1}`); else return noProblemThenGoodbye();
    return callback(null, twiml);
  }

  if (step === 'name') {
    const spoken = (event.SpeechResult || '').trim();
    if (spoken) {
      twiml.redirect({ method:'POST' }, `/tech-callback?step=number&name=${encodeURIComponent(spoken)}`);
      return callback(null, twiml);
    }
    if (n < 1) {
      const g = twiml.gather({ method:'POST', input:'speech', timeout:7, speechTimeout:'auto',
        action:'/tech-callback?step=name', actionOnEmptyResult:true });
      g.say({ voice }, 'Sorry, I didn\'t catch that. Please say your first name.');
      twiml.redirect({ method:'POST' }, `/tech-callback?step=name&n=${n+1}`);
      return callback(null, twiml);
    }
    return noProblemThenGoodbye();
  }

  if (step === 'number') {
    const tail = (from || '').replace(/\D/g,'').slice(-4);
    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:1, timeout:8,
      action:`/tech-callback?step=number_choice&name=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}`,
      actionOnEmptyResult:true
    });
    g.say({ voice }, `Did you want the tech to call you back on the number ending in ${tail}? Press 1 for yes or 2 to enter a different 10 digit number.`);
    if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=number_choice&name=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}&n=${n+1}`); else return noProblemThenGoodbye();
    return callback(null, twiml);
  }

  if (step === 'number_choice') {
    if (d === '1') {
      twiml.redirect({ method:'POST' }, `/tech-callback?step=store_city&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(from)}`);
      return callback(null, twiml);
    }
    if (d === '2') {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:10, timeout:8,
        action:`/tech-callback?step=number_set&name=${encodeURIComponent(name)}`, actionOnEmptyResult:true
      });
      g.say({ voice }, 'Please enter the 10 digit callback number.');
      if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=number_set&name=${encodeURIComponent(name)}&n=${n+1}`); else return noProblemThenGoodbye();
      return callback(null, twiml);
    }
    // nudge
    if (n < 1) {
      const g = twiml.gather({ method:'POST', input:'dtmf', numDigits:1, timeout:5,
        action:`/tech-callback?step=number_choice&name=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}`, actionOnEmptyResult:true });
      g.say({ voice }, 'Sorry, I didn\'t get that. Press 1 to use this number, or 2 to enter a different number.');
      twiml.redirect({ method:'POST' }, `/tech-callback?step=number_choice&name=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}&n=${n+1}`);
      return callback(null, twiml);
    }
    return noProblemThenGoodbye();
  }

  if (step === 'number_set') {
    const to = (event.Digits || '').replace(/\D/g,'');
    if (to.length === 10) {
      const e164 = `+1${to}`;
      twiml.redirect({ method:'POST' }, `/tech-callback?step=store_city&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(e164)}`);
      return callback(null, twiml);
    }
    return noProblemThenGoodbye();
  }

  if (step === 'store_city') {
    const g = twiml.gather({
      method:'POST', input:'speech', timeout:7, speechTimeout:'auto',
      action:`/tech-callback?step=issue&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(cb)}`, actionOnEmptyResult:true
    });
    g.say({ voice }, 'Please tell me the store name and city where the A T M is located.');
    if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=store_city&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(cb)}&n=${n+1}`); else return noProblemThenGoodbye();
    return callback(null, twiml);
  }

  if (step === 'issue') {
    const g = twiml.gather({
      method:'POST', input:'speech', timeout:7, speechTimeout:'auto',
      action:`/tech-callback?step=geo_offer&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(cb)}`, actionOnEmptyResult:true
    });
    g.say({ voice }, 'In a few brief words, what are you calling about?');
    if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=issue&name=${encodeURIComponent(name)}&cb=${encodeURIComponent(cb)}&n=${n+1}`); else return noProblemThenGoodbye();
    return callback(null, twiml);
  }

  if (step === 'geo_offer') {
    const g = twiml.gather({
      method:'POST', input:'dtmf', numDigits:1, timeout:8,
      action:`/tech-callback?step=geo_choice&cb=${encodeURIComponent(cb)}`, actionOnEmptyResult:true
    });
    g.say({ voice }, 'If you\'re currently near the A T M, I can send you a secure link to share your location to help our technician. Press 1 to receive the link now, or press 2 to skip.');
    if (n < 1) twiml.redirect({ method:'POST' }, `/tech-callback?step=geo_choice&cb=${encodeURIComponent(cb)}&n=${n+1}`); else return noProblemThenGoodbye();
    return callback(null, twiml);
  }

  if (step === 'geo_choice') {
    if (d === '1') {
      if (cb && GEO_URL) await sendSms(cb, `Please click the link to share your ATM location: ${GEO_URL}`);
      say('Awesome! I\'ve just sent you a text with the link. Please tap it to share your location, and a technician will call you back shortly.');
      return goodbye();
    }
    if (d === '2') {
      say('No problem. A technician will call you back shortly.');
      return goodbye();
    }
    if (n < 1) {
      const g = twiml.gather({
        method:'POST', input:'dtmf', numDigits:1, timeout:5,
        action:`/tech-callback?step=geo_choice&cb=${encodeURIComponent(cb)}`, actionOnEmptyResult:true
      });
      g.say({ voice }, 'Sorry, I didn\'t get that. Press 1 to receive the link, or 2 to skip.');
      twiml.redirect({ method:'POST' }, `/tech-callback?step=geo_choice&cb=${encodeURIComponent(cb)}&n=${n+1}`);
      return callback(null, twiml);
    }
    return noProblemThenGoodbye();
  }

  // fallback
  twiml.redirect({ method:'POST' }, '/tech-callback?step=start');
  return callback(null, twiml);
};
