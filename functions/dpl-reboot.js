// /functions/dpl-reboot.js — reboot helper with GEO link (press 2)
exports.handler = async (context, event, callback) => {
  const vr = new Twilio.twiml.VoiceResponse();
  const voice = context.POLLY_VOICE || 'Polly.Joanna-Neural';

  const proto = event.headers?.['x-forwarded-proto'] || event.headers?.['X-Forwarded-Proto'] || 'https';
  const host  = event.headers?.host || event.headers?.Host || 'voiceagent-v4-7027-ui-environment.twil.io';
  const base  = `${proto}://${host}`;

  const step   = (event.step || 'ivr').toLowerCase();
  const reason = (event.reason || '').toLowerCase();
  const from   = event.From || '';

  const GEO = context.GEO_URL || `${base}/assist.html?mode=geo`;

  // helper to send SMS
  async function sendSms(body) {
    if (!from || !/^\+?[1-9]\d{6,15}$/.test(from)) return false;
    const client = context.getTwilioClient();
    const opts = context.MESSAGING_SERVICE_SID
      ? { messagingServiceSid: context.MESSAGING_SERVICE_SID, to: from, body }
      : { from: context.SMS_FROM, to: from, body };
    const resp = await client.messages.create(opts);
    console.log('[dpl-reboot] sms sent', resp.sid);
    return true;
  }

  if (step === 'ivr') {
    let intro, tips, guideLink;
    if (reason === 'screen_loop') {
      intro = 'I can help with a frozen or looping screen.';
      tips  = [
        'On the terminal, turn the power switch off.',
        'Wait 30 seconds.',
        'Turn power back on and allow the system to fully boot.'
      ];
      guideLink = `${base}/assist.html?mode=reboot&reason=screen_loop`;
    } else if (reason === 'stuck_card') {
      intro = 'Let us try a safe card recovery.';
      tips  = [
        'Ask the customer to remain present.',
        'Power cycle the terminal once to release the shutter.',
        'If the card presents, remove it and verify the customer identity.'
      ];
      guideLink = `${base}/assist.html?mode=reboot&reason=stuck_card`;
    } else {
      vr.say({ voice }, 'I will return you to the main menu.');
      vr.redirect({ method: 'POST' }, `${base}/main-menu?step=menu`);
      return callback(null, vr);
    }

    vr.say({ voice }, intro);
    for (const t of tips) vr.say({ voice }, t);

    // Offer: 1) text step-by-step guide, 2) text geo link to auto-find DPL serial
    const g = vr.gather({
      input: 'dtmf',
      numDigits: 1,
      timeout: 7,
      action: `${base}/dpl-reboot?step=sms&reason=${encodeURIComponent(reason)}&guide=${encodeURIComponent(guideLink)}&geo=${encodeURIComponent(GEO)}`,
      method: 'POST',
      actionOnEmptyResult: true
    });
    g.say({ voice }, 'Press 1 to receive a step by step guide by text. Press 2 to receive a link that uses your location to find the D P L serial and send a one tap reboot link. Or press 3 to finish.');
    return callback(null, vr);
  }

  if (step === 'sms') {
    const d = (event.Digits || '').trim();
    const guide = event.guide || `${base}/assist.html?mode=reboot&reason=${encodeURIComponent(reason)}`;
    const geo = event.geo || GEO;

    if (d === '1') {
      try {
        const ok = await sendSms(`Reboot guide: ${guide}`);
        if (ok) { vr.say({ voice }, 'I sent a text with the guide. Goodbye.'); vr.hangup(); return callback(null, vr); }
      } catch (e) { console.log('[dpl-reboot] sms guide failed', e && e.message); }
      vr.say({ voice }, 'I could not send the text right now. Goodbye.'); vr.hangup(); return callback(null, vr);
    }

    if (d === '2') {
      try {
        const ok = await sendSms(`Find nearest ATM and one-tap reboot: ${geo}`);
        if (ok) { vr.say({ voice }, 'I sent a text with the location link. Goodbye.'); vr.hangup(); return callback(null, vr); }
      } catch (e) { console.log('[dpl-reboot] sms geo failed', e && e.message); }
      vr.say({ voice }, 'I could not send the text right now. Goodbye.'); vr.hangup(); return callback(null, vr);
    }

    vr.say({ voice }, 'Okay. Goodbye.'); vr.hangup(); return callback(null, vr);
  }

  vr.redirect({ method: 'POST' }, `${base}/dpl-reboot?step=ivr&reason=${encodeURIComponent(reason)}`);
  callback(null, vr);
};
