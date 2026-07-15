'use strict';

const { createScrapeTask } = require('../ScrapeTask');
const scraper = require('../../scrapper/scraper');

class SingleSchoolStrategy {
  
  constructor(params = {}) {
    this.tasks = Object.freeze([createScrapeTask(params)]);
  }

  getTasks() {
    return [...this.tasks];
  }

  /**
   * Defines THIS strategy's scraping order/steps for one task.
   * Different strategies could call these in a different order,
   * skip steps, or use entirely different scraper functions.
   */
  async execute(page, task) {
    await scraper.selectYearAndCycle(page, {
      yearLabel: task.year,
      teachingType: task.teaching_cycle,
    });
    await scraper.selectDistrict(page, task.district);
    await scraper.selectCity(page, task.city);
    await scraper.selectSchool(page, task.school);
    await scraper.selectAllSubjects(page);
    await scraper.goToBooks(page);

    return scraper.extractBooks(page);
  }
}

module.exports = SingleSchoolStrategy;