exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  // keep it simple: always punt to the main sales flow
  twiml.redirect({ method: 'POST' }, '/sales?step=menu');
  return callback(null, twiml);
};
