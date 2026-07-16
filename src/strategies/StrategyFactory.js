"use strict";

const SingleSchoolStrategy = require("./implementations/SingleSchoolStrategy");

/**
 * Maps the strategy name received by the API to the class that creates its plan.
 */
const STRATEGIES = Object.freeze({
  single_school: SingleSchoolStrategy,

});

/**
 * Creates the strategy requested by the API.
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