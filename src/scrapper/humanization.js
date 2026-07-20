'use strict';

/**
 * Returns a random delay between navigation actions,
 */

/**
 * Returns a random integer in [min, max], inclusive.
 */
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Waits a random amount of time between `min` and `max` milliseconds.
 */
async function humanDelay(min = 400, max = 1200) {
  const ms = randomInt(min, max);
  await new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { humanDelay, randomInt };
