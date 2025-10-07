// /main-menu.js — Verbatim opening script + absolute redirects to the UI env
exports.handler = function (context, event, callback) {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // Hard-pin to the correct live domain
  const HOST = "citvan-clean-6447-ui.twil.io";
  const BASE = `https://${HOST}`;

  const step = (event.step || 'menu').toString();
  const n = parseInt(event.n || '0', 10) || 0;

  function say(r, text) { r.say({ voice: 'Polly.Joanna-Neural' }, text); }
  function pause(r, seconds = 0.6) { r.pause({ length: seconds }); }
  function abs(path, qs = {}) {
    const u = new URL(BASE + path);
    for (const [k, v] of Object.entries(qs)) u.searchParams.set(k, v);
    return u.toString();
  }

  if (step === 'menu') {
    const next = abs('/main-menu', { step: 'route' });
    const g = twiml.gather({ input: 'dtmf', numDigits: 1, timeout: 7, method: 'POST', action: next });

    // === VERBATIM SCRIPT (two lines), with a light pause between ===
    say(g, "Thank you for contacting ATM Support. If you have questions about pricing and product information, or you're looking to purchase or place an A T M, press 1.");
    pause(g, 0.6);
    say(g, "If you have an error code on your A T M screen, press 2. If you're experiencing an issue such as a stuck card or not receiving cash, press 3. Or to have a technician call you back, press 4. Please make your selection now.");

    // One gentle reprompt, then goodbye
    if (n >= 1) {
      say(twiml, "No problem. Call us back if you need anything. Goodbye.");
      twiml.hangup();
    } else {
      twiml.redirect({ method: 'POST' }, abs('/main-menu', { step: 'menu', n: n + 1 }));
    }
    return callback(null, twiml);
  }

  if (step === 'route') {
    const d = (event.Digits || '').trim();
    if (d === '1') { twiml.redirect({ method: 'POST' }, abs('/sales', { step: 'choice' })); return callback(null, twiml); }
    if (d === '2') { twiml.redirect({ method: 'POST' }, abs('/atm-error-lookup', { step: 'collect' })); return callback(null, twiml); }
    if (d === '3') { twiml.redirect({ method: 'POST' }, abs('/issues', { step: 'menu' })); return callback(null, twiml); }
    if (d === '4') { twiml.redirect({ method: 'POST' }, abs('/tech-callback', { step: 'start' })); return callback(null, twiml); }

    // Invalid → back to menu
    twiml.redirect({ method: 'POST' }, abs('/main-menu', { step: 'menu' }));
    return callback(null, twiml);
  }

  // Fallback → menu
  twiml.redirect({ method: 'POST' }, abs('/main-menu', { step: 'menu' }));
  return callback(null, twiml);
};
