'use strict';

const { createScrapeTask } = require('../ScrapeTask');
const scraper = require('../../scrapper/scraper');

/**
 * Variante da SingleSchoolStrategy: distrito/cidade via mapa SVG
 * (index_tooltips.js) em vez dos combos. Fallback enquanto CITY_COMBO/
 * SCHOOL_COMBO estiverem [UNVERIFIED] em selectors.js.
 */
class SingleSchoolStrategyTooltip {

  constructor(params = {}) {
    this.tasks = Object.freeze([createScrapeTask(params)]);
  }

  getTasks() {
    return [...this.tasks];
  }

  async execute(page, task) {
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