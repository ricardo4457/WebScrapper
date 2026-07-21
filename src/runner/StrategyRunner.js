"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");
const bookPayload = require("../payloads/BookPayload");
const { humanDelay } = require("../scrapper/humanization");
const { BlockDetectedError } = require("../scrapper/blockDetection");

class StrategyRunner {
  static async run(input) {
    const { strategy: strategyName, ...params } = input;
    const strategy = createStrategy(strategyName, params);
    const results = [];
    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

      // Reuse the page between tasks.
      let page = await browserManager.openBasePage();

      // getTasks() must run after the page exists, not before launch()
      // above: discovery-based strategies (e.g. FullDistrictStrategy)
      // need a live page to walk the district/city/school combos and
      // build their task list. Fixed strategies just ignore the page
      // argument. await works either way, whether getTasks() returns a
      // Promise or a plain array.
      const tasks = await strategy.getTasks(page);

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (i > 0) {
          // Build the standard payload from the scraped books.
          await humanDelay(800, 2000);
          await browserManager.resetToBasePage(page);
        }

        try {
          // Build the standard payload from the scraped books.
          const books = await strategy.execute(page, task);
          results.push(bookPayload.buildImportPayload(task, books));
        } catch (error) {
          if (error instanceof BlockDetectedError) {
            // Stop processing if the site blocks the scraper.
            console.error(
              `[StrategyRunner] Block detected, aborting remaining tasks: ${error.reason}`,
            );

            const remainingTasks = tasks.slice(i);
            for (const remainingTask of remainingTasks) {
              results.push({
                school: {
                  name: remainingTask.school,
                  district: remainingTask.district,
                  city: remainingTask.city,
                },
                error: `Batch aborted due to site blocking: ${error.reason}`,
                items: [],
              });
            }
            break;
          }

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
          } catch (recreateError) {
            if (recreateError instanceof BlockDetectedError) {
              // Stop processing if the site blocks page recreation.
              console.error(
                `[StrategyRunner] Block detected while recreating page, aborting remaining tasks: ${recreateError.reason}`,
              );

              const remainingTasks = tasks.slice(i + 1);
              for (const remainingTask of remainingTasks) {
                results.push({
                  school: {
                    name: remainingTask.school,
                    district: remainingTask.district,
                    city: remainingTask.city,
                  },
                  error: `Batch aborted due to site blocking: ${recreateError.reason}`,
                  items: [],
                });
              }
              break;
            }
            // Let the next task handle the page error.
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