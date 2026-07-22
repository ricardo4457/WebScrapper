"use strict";

const { createScrapeTask } = require("../ScrapeTask");
const scraper = require("../../scrapper/scraper");

/**
 * Single school strategy using the SVG map for district and city selection.
 * Temporary fallback until combo selectors are supported.
 */
class SingleSchoolStrategyTooltip {
  constructor(params = {}) {
    this.tasks = Object.freeze([createScrapeTask(params)]);
  }

  getTasks() {
    return [...this.tasks];
  }

  /**
   * Returns the raw scraped books.
   */
  async execute(page, task, _opts) {
    await scraper.selectYearAndCycle(page, {
      yearLabel: task.year,
      teachingType: task.teaching_cycle,
    });
    await scraper.selectDistrictViaMap(page, task.district);
    await scraper.selectCityViaMap(page, task.city);
    await scraper.selectSchool(page, task.school);
    await scraper.selectAllSubjects(page);
    await scraper.goToBooks(page);

    return scraper.extractBooks(page);
  }
}

module.exports = SingleSchoolStrategyTooltip;