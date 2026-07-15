"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");
const scraper = require("../scrapper/scraper");

class StrategyRunner {
  /**
   * Runs one strategy end-to-end.
   *
   * @param {object} input - Input containing strategy name and parameters.
   * @returns {Promise<Array>} The compiled scraping results.
   */
  static async run(input) {
    const { strategy: strategyName, ...params } = input;
    const strategy = createStrategy(strategyName, params);
    const tasks = strategy.getTasks();

    const results = [];
    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const page = await browserManager.openBasePage();

        try {
          await scraper.selectYearAndCycle(page, {
            yearLabel: task.year,
            teachingType: task.teaching_cycle,
          });

          await scraper.selectDistrict(page, task.district);
          await scraper.selectCity(page, task.city);
          await scraper.selectSchool(page, task.school);
          await scraper.selectAllSubjects(page);
          await scraper.goToBooks(page);

          const books = await scraper.extractBooks(page);
          results.push({ task, books });
        } finally {
          if (page) {
            await page.close().catch(() => {});
          }
        }
      }

      return results;
    } finally {
      await browserManager.close();
    }
  }
}

module.exports = StrategyRunner;
