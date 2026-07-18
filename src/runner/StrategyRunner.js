"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");
const bookPayload = require("../payloads/BookPayload");

class StrategyRunner {
  static async run(input) {
    const { strategy: strategyName, ...params } = input;
    const strategy = createStrategy(strategyName, params);
    const tasks = strategy.getTasks();
    const results = [];
    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

      // Reuse the page between tasks.
      let page = await browserManager.openBasePage();

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (i > 0) {
          await browserManager.resetToBasePage(page);
        }

        try {
          // Build the standard payload from the scraped books.
          const books = await strategy.execute(page, task);
          results.push(bookPayload.buildImportPayload(task, books));
        } catch (error) {
          // Continue processing the remaining tasks if one fails.
          results.push({
            school: {
              name: task.school,
              district: task.district,
              city: task.city,
            },
            error: error.message,
            items: [],
          });

          // Recreate the page if it becomes unusable.
          try {
            await page.close().catch(() => {});
            page = await browserManager.openBasePage();
          } catch (e) {
            // Recreate the page if it becomes unusable.
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
