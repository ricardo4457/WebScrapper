"use strict";

const { createScrapeTask } = require("../ScrapeTask");
const scraper = require("../../scrapper/scraper");
const { timed } = require("../../utils/RunTimings");

class SingleSchoolStrategy {
  constructor(params = {}) {
    this.tasks = Object.freeze([createScrapeTask(params)]);
  }

  getTasks() {
    return [...this.tasks];
  }

  /**
   * Runs the scraping flow for a single school.
   * Returns the raw scraped books. Third param exists only so
   * StrategyRunner can call every strategy the same way
   */
  async execute(page, task) {
    await timed(page, "navigation", async () => {
      await scraper.selectYearAndCycle(page, {
        yearLabel: task.year,
        teachingType: task.teaching_cycle,
      });
      await scraper.selectDistrict(page, task.district);
      await scraper.selectCity(page, task.city);
      await scraper.selectSchool(page, task.school);
      await scraper.waitForLoadingToFinish(page);
    });

    return timed(page, "book_extraction", async () => {
      await scraper.selectAllSubjects(page);
      await scraper.goToBooks(page);
      return scraper.extractBooks(page);
    });
  }
}

module.exports = SingleSchoolStrategy;
