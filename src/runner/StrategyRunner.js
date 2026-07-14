'use strict';

const { createStrategy } = require('../strategies');
const { BrowserManager } = require('../scrapper/browser');
const scraper = require('../scrapper/scraper');

/**
 * Runs one strategy end-to-end.
 *
 * 1. Builds the task plan from the strategy (pure, no I/O).
 * 2. Launches ONE browser for the whole job (reused across every task, to
 *    avoid the cost of relaunching Chromium per school).
 * 3. For each task: opens a fresh page, walks the dropdown flow
 *    (year/cycle -> district -> city -> school -> subjects -> books),
 *    extracts the adopted books, and closes the page.
 * 4. Reports progress after each task via onProgress.
 *
 * @param {object} input Same shape as ScrapeJob.getStrategyData():
 *   { strategy, year, teaching_cycle, district, city, school } for single_school, or
 *   { strategy, year, teaching_cycle, district, schools: [{ city, school }] } for full_district.
 * @param {(progress: { done: number, total: number, task?: object }) => void} [onProgress]
 * @returns {Promise<Array<{ task: import('../strategies/ScrapeTask').ScrapeTask, books: object[] }>>}
 */
async function StrategyRunner(input, onProgress = () => {}) {
  const { strategy: strategyName, ...params } = input;
  const strategy = createStrategy(strategyName, params);
  const tasks = strategy.getTasks();

  const results = [];
  const browserManager = new BrowserManager();

  try {
    await browserManager.launch();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      onProgress({ done: i, total: tasks.length, task });

      const page = await browserManager.openBasePage();

      try {
        // NOTA: assume-se que `task.year` corresponde ao texto visível do
        // botão do ano (yearLabel). Se o Laravel vier a enviar o
        // data-value do botão em vez do texto, trocar para
        // { yearValue: task.year, teachingType: task.teaching_cycle }.
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
        await page.close().catch(() => {});
      }
    }

    onProgress({ done: tasks.length, total: tasks.length });
    return results;
  } finally {
    await browserManager.close();
  }
}

module.exports = { StrategyRunner };