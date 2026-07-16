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
      for (const task of tasks) {
        const page = await browserManager.openBasePage();
        try {
          const books = await strategy.execute(page, task);
          // Estrutura esperada pelo BookImportService do Laravel
          results.push({
            school: {
              name: task.school, // Certifica-te que 'task' tem estes campos
              district: task.district,
              city: task.city
            },
            items: books
          });
        } finally {
          await page.close().catch(() => {});
        }
      }
      return results;
    } finally {
      await browserManager.close();
    }
  }
}
module.exports = StrategyRunner;