'use strict';

const { createScrapeTask } = require('../ScrapeTask');

/**
 * Plans scraping for one school in one school year.
 *
 * Input must use the canonical Node API contract:
 * { year, teaching_cycle, district, city, school }
 */
class SingleSchoolStrategy {
  /**
   * @param {object} params One school and school-year selection.
   */
  constructor(params = {}) {
    this.tasks = Object.freeze([createScrapeTask(params)]);
  }

  /**
   * A new array is returned so callers cannot change the strategy's plan.
   *
   * @returns {import('../ScrapeTask').ScrapeTask[]}
   */
  getTasks() {
    return [...this.tasks];
  }
}

module.exports = SingleSchoolStrategy;
