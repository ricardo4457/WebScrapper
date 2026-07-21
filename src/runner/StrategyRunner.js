"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");
const bookPayload = require("../payloads/BookPayload");
const { humanDelay } = require("../scrapper/humanization");
const { BlockDetectedError } = require("../scrapper/blockDetection");

class StrategyRunner {
  /**
   * Runs a scraping strategy.
   */
  static async run(input, { onProgress } = {}) {
    const { strategy: strategyName, ...params } = input;
    const strategy = createStrategy(strategyName, params);
    const results = [];
    const browserManager = new BrowserManager();

    const reportProgress = async (total) => {
      if (!onProgress) return;
      try {
        await onProgress(results.length, total);
      } catch (progressError) {
        // Ignore progress callback failures.
        console.error(
          `[StrategyRunner] onProgress callback failed: ${progressError.message}`,
        );
      }
    };

    try {
      await browserManager.launch();

      // Reuse the page between tasks.
      let page = await browserManager.openBasePage();

      // Generate tasks after opening the browser.
      const tasks = await strategy.getTasks(page);
      await reportProgress(tasks.length);

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (i > 0) {
          // Add a random delay between tasks.
          await humanDelay(800, 2000);
          await browserManager.resetToBasePage(page);
        }

        try {
          // Build the standard payload from the scraped books.
          const books = await strategy.execute(page, task);
          results.push(bookPayload.buildImportPayload(task, books));
          await reportProgress(tasks.length);
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
            await reportProgress(tasks.length);
            break;
          }

          // Continue with the next task.
          results.push({
            school: {
              name: task.school,
              district: task.district,
              city: task.city,
            },
            error: error.message,
            items: [],
          });
          await reportProgress(tasks.length);

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
              await reportProgress(tasks.length);
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