const patch = require(Runtime.getAssets()['/patch-atm.js'].path);
exports.handler = (context, event, callback) => callback(null, patch);
