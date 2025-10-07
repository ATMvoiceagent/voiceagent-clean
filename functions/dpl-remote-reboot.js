exports.handler = async (context, event, callback) => {
  const deviceId = event.deviceId || event.id || '';
  const km = event.km || '';
  const from = event.From || '';
  console.log('[dpl-remote-reboot] request', { deviceId, km, from });

  // TODO: integrate real DPL API call here.
  // For now, simulate success and log it.
  const ok = !!deviceId;
  if (ok) {
    console.log('[dpl-remote-reboot] reboot ok', { deviceId, km });
  } else {
    console.log('[dpl-remote-reboot] reboot missing deviceId');
  }

  const twiml = new (require('twilio').twiml.VoiceResponse)();
  twiml.say(ok ? 'Reboot requested.' : 'Missing device ID.');
  return callback(null, twiml);
};
