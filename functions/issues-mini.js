// Option 3: Issues mini — robust intent matching + pacing + geo-reboot / claims
exports.handler = async function(context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const client = context.getTwilioClient();

  const VOICE = 'Polly.Joanna-Neural';
  const LANG  = 'en-US';
  const NUDGE_MAX = 1; // one retry, then goodbye

  // ENV
  const SMS_FROM  = context.SMS_FROM || '';
  const MSG_SID   = context.MESSAGING_SERVICE_SID || ''; // optional
  const GEO_URL   = context.GEO_URL || 'https://citvan-clean-6447-ui.twil.io/assist.html?mode=geo';
  const CLAIM_LINK= context.CLAIM_LINK || 'https://citvan-clean-6447-ui.twil.io/claim.html';

  // Helpers
  const say = (text) => twiml.say({ voice: VOICE, language: LANG }, text);
  const pause = (sec=1) => twiml.pause({ length: sec });

  const baseUrl = context.DOMAIN_NAME ? `https://${context.DOMAIN_NAME}` : '';

  const withNudge = (nextUrl, n=0, prompts=[]) => {
    prompts.forEach((p, i) => { say(p); if (i < prompts.length - 1) pause(1); });
    const nudges = Number(n) || 0;
    if (nudges >= NUDGE_MAX) {
      pause(1);
      say("Okay, call us back if you would like more information. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }
    twiml.gather({
      method: 'POST',
      input: 'speech',
      timeout: 7,
      speechTimeout: 'auto',
      hints: 'my card is stuck, card is stuck, the screen is frozen, screen frozen, I did not get my money, I did not get my cash, didn’t get my money',
      action: `${nextUrl}&n=${nudges + 1}`,
      actionOnEmptyResult: true
    });
    return callback(null, twiml);
  };

  const detectIntent = (raw='') => {
    const t = (raw || '').toLowerCase().trim();
    const has = (w) => t.includes(w);
    const any = (...ws) => ws.some(w => has(w));
    const both = (a,b) => has(a) && has(b);

    if (both('card','stuck') || any('my card is stuck','card is stuck','stuck card','kept my card','ate my card','swallowed my card','card retained','card capture')) {
      return 'card_stuck';
    }
    if (any('screen is frozen','the screen is frozen','screen frozen','frozen screen','screen unresponsive','screen not responding','touchscreen not responding')) {
      return 'screen_frozen';
    }
    if (any("didn't get my money","didnt get my money","did not get my money","didn't get cash","didnt get cash","no cash","money not dispensed","cash not received","didn't receive money","didnt receive money","dispense failed")) {
      return 'no_cash';
    }
    return 'unknown';
  };

  const step = (event.step || 'start').toLowerCase();
  const n = event.n || 0;

  if (step === 'start') {
    return withNudge(
      `${baseUrl}/issues-mini?step=first`,
      n,
      [
        "Alright, briefly describe the issue you're having with the A T M.",
        "You can say things like, my card is stuck, the screen is frozen, or I didn't get my money."
      ]
    );
  }

  if (step === 'first') {
    const speech = event.SpeechResult || '';
    const intent = detectIntent(speech);
    console.log('[issues-mini] speech ->', { speech, intent });

    const sms = async (to, body) => {
      if (!to) return;
      try {
        if (MSG_SID) await client.messages.create({ to, messagingServiceSid: MSG_SID, body });
        else if (SMS_FROM) await client.messages.create({ to, from: SMS_FROM, body });
        console.log('[issues-mini] SMS sent', { to, body });
      } catch (e) {
        console.error('[issues-mini] SMS failed', e);
      }
    };

    if (intent === 'card_stuck') {
      await sms(event.From, `Please click the link to share your ATM location: ${GEO_URL}`);
      say("Okay, I’m sending you a secure text link to locate the A T M."); pause(1);
      say("Please tap the link to share your location, which will enable us to automatically reboot the A T M."); pause(1);
      say("Once the power is cut, you’ll be able to retrieve your card."); pause(1);
      say("If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M."); pause(1);
      say("If you're still unable to get your card, please call us back and select option 4. A technician will return your call."); pause(1);
      say("Thank you for contacting A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    if (intent === 'screen_frozen') {
      await sms(event.From, `Please click the link to share your ATM location: ${GEO_URL}`);
      say("Okay, I’m sending you a secure text link to locate the A T M."); pause(1);
      say("Please tap the link to share your location, which will enable us to automatically reboot the A T M."); pause(1);
      say("This will reset the A T M, and it should be ready for use once it powers back up."); pause(1);
      say("This action will also release your card if it’s currently stuck."); pause(1);
      say("If the A T M doesn’t power off and it's safe to do so, you or someone else can unplug the A T M."); pause(1);
      say("If you're still unable to get your card, please call us back and select option 4. A technician will return your call."); pause(1);
      say("Thank you for contacting A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    if (intent === 'no_cash') {
      await sms(event.From, `Claim form link: ${CLAIM_LINK}`);
      say("I've sent you a text message with a link to the claim form."); pause(1);
      say("Please fill it out and our team will follow up."); pause(1);
      say("Thanks for calling A T M support. Goodbye.");
      twiml.hangup();
      return callback(null, twiml);
    }

    const nudges = Number(event.n || 0);
    if (nudges < NUDGE_MAX) {
      return withNudge(
        `${baseUrl}/issues-mini?step=first`,
        nudges,
        [ "Sorry, can you say that again?" ]
      );
    }
    say("I’m having trouble understanding. I’ll have a technician call you back shortly.");
    twiml.redirect({ method: 'POST' }, '/tech-callback?step=start&reason=issues_unknown');
    return callback(null, twiml);
  }

  // default restart
  return withNudge(
    `${baseUrl}/issues-mini?step=first`,
    n,
    [
      "Alright, briefly describe the issue you're having with the A T M.",
      "You can say things like, my card is stuck, the screen is frozen, or I didn't get my money."
    ]
  );
};
1759687063

// touch 1759687475
