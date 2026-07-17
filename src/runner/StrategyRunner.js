"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");

class StrategyRunner {
  static async run(input) {
    const { strategy: strategyName, ...params } = input;
    const strategy = createStrategy(strategyName, params);
    const tasks = strategy.getTasks();
    const results = [];
    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

      // Reuse page to improve speed and avoid re-triggering cookie banners
      let page = await browserManager.openBasePage();

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (i > 0) {
          await browserManager.resetToBasePage(page);
        }

        const schoolInfo = {
          name: task.school,
          district: task.district,
          city: task.city,
        };

        try {
          const books = await strategy.execute(page, task);

          // Map raw data to match Laravel's snake_case requirements
          results.push({
            school: schoolInfo,
            items: books.map((book) => ({
              title: book.title,
              publisher: book.publisher,
              cover_path: book.coverImage,
              price: book.price,
              discipline: book.discipline,
              type: book.type,
              year: task.year,
              teaching_cycle: task.teaching_cycle,
            })),
          });
        } catch (error) {
          // Log error for this task and continue batch processing
          results.push({
            school: schoolInfo,
            error: error.message,
            items: [],
          });

          // Reset page state to recover from potential navigation crashes
          try {
            await page.close().catch(() => {});
            page = await browserManager.openBasePage();
          } catch (e) {
            // Recovery failed; next iteration will try again
          }
        }
      }

      await page.close().catch(() => {});
      return results;
    } finally {
      await browserManager.close();
    }
  }
}

module.exports = StrategyRunner;
