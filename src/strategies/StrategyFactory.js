"use strict";

const SingleSchoolStrategy = require("./implementations/SingleSchoolStrategy");
const SingleSchoolStrategyTooltip = require("./implementations/SingleSchoolStrategyTooltip");

/**
 * Maps the strategy name received by the API to the class that creates its plan.
 */
const STRATEGIES = Object.freeze({
  single_school: SingleSchoolStrategy,
 single_school_tooltip: SingleSchoolStrategyTooltip,

});

/**
 * Creates the strategy requested by the API.
 *
 * @param {string} name - Strategy name (e.g., 'single_school').
 * @param {object} params - Data required by the selected strategy.
 * @returns {SingleSchoolStrategy}
 */
function createStrategy(name, params = {}) {
  const Strategy = STRATEGIES[name];

  if (!Strategy) {
    throw new Error(`Unknown scraping strategy '${name}'.`);
  }

  return new Strategy(params);
}

module.exports = {
  createStrategy,
};