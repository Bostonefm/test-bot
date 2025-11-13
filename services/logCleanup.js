// services/logCleanup.js
// Compatibility bridge for Grizzly Bot v2
// Allows services/scheduler.js to require('./logCleanup.js')
// while actual logic lives in modules/logCleanup.js

module.exports = require('../modules/logCleanup.js');
