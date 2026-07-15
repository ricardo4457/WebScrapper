"use strict";

const FullDistrictStrategy = require("./implementations/FullDistrictStrategy");
const SingleSchoolStrategy = require("./implementations/SingleSchoolStrategy");

/**
 * Maps the strategy name received by the API to the class that creates its plan.
 */
const STRATEGIES = Object.freeze({
  single_school: SingleSchoolStrategy,
  full_district: FullDistrictStrategy,
});

/**
 * Creates the strategy requested by the API.
 *
 * @param {string} name - Strategy name (e.g., 'single_school' or 'full_district').
 * @param {object} params - Data required by the selected strategy.
 * @returns {SingleSchoolStrategy|FullDistrictStrategy}
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