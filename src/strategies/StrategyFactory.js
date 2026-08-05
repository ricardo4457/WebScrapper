"use strict";

const SingleSchoolStrategy = require("./implementations/SingleSchoolStrategy");
const SingleSchoolStrategyTooltip = require("./implementations/SingleSchoolStrategyTooltip");
const FullDistrictStrategy = require("./implementations/FullDistrictStrategy");
const FullCityStrategy = require("./implementations/FullCityStrategy");
const FullTeachingCyleStrategy = require("./implementations/FullTeachingCyleStrategy");
/**
 * Maps the strategy name received by the API to the class that creates its plan.
 */
const STRATEGIES = Object.freeze({
  single_school: SingleSchoolStrategy,
  single_school_tooltip: SingleSchoolStrategyTooltip,
  full_district: FullDistrictStrategy,
  full_city: FullCityStrategy,
  full_teaching_cycle: FullTeachingCyleStrategy,
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

function isValidStrategy(name) {
  return Object.prototype.hasOwnProperty.call(STRATEGIES, name);
}

module.exports = {
  createStrategy,
  isValidStrategy,
  STRATEGY_NAMES: Object.keys(STRATEGIES),
};