exports.handler = async (context, event, callback) => {
  console.log('[recording-status]', {
    callSid: event.CallSid,
    recSid: event.RecordingSid,
    url: event.RecordingUrl,
    status: event.RecordingStatus,
    duration: event.RecordingDuration
  });
  return callback(null, '<Response/>');
};
