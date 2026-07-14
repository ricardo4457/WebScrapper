"use strict";

const FullDistrictStrategy = require("./implementations/FullDistrictStrategy");
const SingleSchoolStrategy = require("./implementations/SingleSchoolStrategy");

/**
 * Maps the strategy name received by the API to the class that creates its plan.
 *
 * Keeping this decision here prevents routes and the Worker from having
 * repeated if/else blocks to select a strategy.
 */
const STRATEGIES = Object.freeze({
  single_school: SingleSchoolStrategy,
  full_district: FullDistrictStrategy,
});

/**
 * Creates the strategy requested by the API.
 *
 * Example:
 * const strategy = createStrategy('single_school', payload);
 * const tasks = strategy.getTasks();
 *
 * The constructor validates the input and creates the task plan. getTasks()
 * returns a copy of that validated plan.
 *
 * @param {string} name Strategy name: single_school, full_district, or all_years.
 * @param {object} params Data required by the selected strategy.
 * @returns {SingleSchoolStrategy|FullDistrictStrategy|AllYearsStrategy}
 */
function createStrategy(name, params = {}) {
  const Strategy = STRATEGIES[name];

  if (!Strategy) {
    throw new Error(`Unknown scraping strategy '${name}'.`);
  }

  return new Strategy(params);
}

module.exports = ScrapeTask;
