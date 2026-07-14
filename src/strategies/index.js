'use strict';

/**
 * Public entry point for the strategies folder.
 *
 * In Node.js, require('./strategies') automatically looks for this index.js
 * file. The factory lives in StrategyFactory.js and the concrete strategy
 * classes live in implementations/. This file only preserves a convenient
 * and stable import path for the rest of the application.
 */
module.exports = require('./StrategyFactory');
