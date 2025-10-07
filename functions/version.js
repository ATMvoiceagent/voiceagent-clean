exports.handler = async (context, event, callback) => {
  // Show a simple text line with environment + version marker
  const version = context.VERSION || 'unversioned';
  const envName = context.DOMAIN_NAME || 'unknown-env';
  const body = `env=${envName} version=${version}`;
  return callback(null, {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body
  });
};
