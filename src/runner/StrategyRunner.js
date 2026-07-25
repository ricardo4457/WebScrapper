"use strict";

const { createStrategy } = require("../strategies");
const { BrowserManager } = require("../scrapper/browser");
const bookPayload = require("../payloads/BookPayload");
const { humanDelay } = require("../scrapper/humanization");
const { BlockDetectedError } = require("../scrapper/blockDetection");
const ResultBatchService = require("../services/ResultBatchService");
const {
  partitionTasksIntoLanes,
  locationKey,
} = require("../strategies/ScrapeTask");

// Default number of parallel BrowserContexts.
const DEFAULT_CONCURRENCY = 2;

// Upper limit to avoid excessive simultaneous requests
const MAX_CONCURRENCY = 4;

class StrategyRunner {
  /**
   * Executes the selected scraping strategy.
   *
   * Creates the browser, discovers the tasks to execute, distributes them
   * across multiple execution lanes, and aggregates all results.
   *
   * Each lane runs in its own BrowserContext while sharing the same browser
   * process for better performance.
   *
   */
  static async run(
    input,
    { onProgress, concurrency, jobToken, batchSize } = {},
  ) {
    const {
      strategy: strategyName,
      concurrency: requestedConcurrency,
      callback_url,
      run_token,
      ...params
    } = input;
    const strategy = createStrategy(strategyName, params);
    const browserManager = new BrowserManager();
    const resolvedConcurrency = concurrency || requestedConcurrency;

    // Streams results to Laravel in batches instead of holding every school's
    // books in memory for the whole run (see ResultBatchService).
    const batchService = new ResultBatchService({
      callbackUrl: callback_url,
      runToken: run_token,
      jobToken,
      batchSize,
    });

    // Shared state between all execution lanes.
    const state = {
      completedCount: 0,
      blocked: null,
      batchService,
    };

    const reportProgress = async (total) => {
      if (!onProgress) return;
      try {
        await onProgress(state.completedCount, total);
      } catch (progressError) {
        // Progress updates should never interrupt the scraping process.
        console.error(
          `[StrategyRunner] onProgress callback failed: ${progressError.message}`,
        );
      }
    };

    try {
      // Start Browser
      await browserManager.launch();

      // Task discovery uses a temporary page that is discarded once all tasks
      // have been collected.
      const discoveryPage = await browserManager.openBasePage();
      const tasks = await strategy.getTasks(discoveryPage);
      await discoveryPage.close().catch(() => {});

      await reportProgress(tasks.length);

      if (tasks.length === 0) {
        return { sentCount: 0, failedEntries: [] };
      }

      const laneCount = Math.max(
        1,
        Math.min(
          resolvedConcurrency || DEFAULT_CONCURRENCY,
          MAX_CONCURRENCY,
          tasks.length,
        ),
      );

      // Keep tasks from the same location in the same lane.
      // This allows consecutive tasks to reuse the current navigation state
      // instead of restarting from the homepage.
      const lanes = partitionTasksIntoLanes(tasks, laneCount);

      console.log(
        `[StrategyRunner] Running ${tasks.length} task(s) across ${lanes.length} lane(s) ` +
          `(sizes: ${lanes.map((lane) => lane.length).join(", ")}).`,
      );

      await Promise.all(
        lanes.map((laneTasks) =>
          StrategyRunner._runLane(laneTasks, {
            strategy,
            browserManager,
            state,
            totalTasks: tasks.length,
            reportProgress,
          }),
        ),
      );

      // Send whatever is left in the buffer .
      await batchService.flush("partial");

      return {
        sentCount: batchService.getSentCount(),
        failedEntries: batchService.getFailedEntries(),
      };
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Executes all tasks assigned to a single lane.
   *
   * Each lane owns its own BrowserContext and processes tasks sequentially,
   * while multiple lanes run concurrently.
   *
   * When consecutive tasks belong to the same location, navigation can be
   * partially reused to reduce unnecessary page transitions.
   */
  static async _runLane(
    laneTasks,
    { strategy, browserManager, state, totalTasks, reportProgress },
  ) {
    const context = await browserManager.newContext();
    let page = await browserManager.openPageInContext(context);
    let previousTask = null;

    // Marks all remaining tasks in this lane as aborted after block detection.
    const abortRemaining = async (fromIndex, reason) => {
      for (const remainingTask of laneTasks.slice(fromIndex)) {
        const entry = {
          school: {
            name: remainingTask.school,
            district: remainingTask.district,
            city: remainingTask.city,
          },
          error: `Batch aborted due to site blocking: ${reason}`,
          items: [],
        };
        await state.batchService.add(entry, { isError: true });
        state.completedCount++;
      }
    };

    try {
      for (let i = 0; i < laneTasks.length; i++) {
        // Stop processing new tasks if another lane has already detected blocking.
        if (state.blocked) {
          await abortRemaining(i, state.blocked);
          await reportProgress(totalTasks);
          break;
        }

        const task = laneTasks[i];

        const sameLocation =
          Boolean(previousTask) &&
          locationKey(previousTask) === locationKey(task);
        // Consecutive tasks from the same location can reuse the current navigation.
        if (i > 0) {
          // Small randomized delay between tasks to simulate human behaviour.
          await humanDelay(800, 2000);
          if (!sameLocation) {
            // Reset to the initial page only when switching to a different location.
            await browserManager.resetToBasePage(page);
          }
        }

        // Convert the scraped books into the format expected by Laravel.
        try {
          const books = await strategy.execute(page, task, { sameLocation });
          const entry = bookPayload.buildImportPayload(task, books);
          await state.batchService.add(entry);
          state.completedCount++;
          previousTask = task;
          await reportProgress(totalTasks);
        } catch (error) {
          if (error instanceof BlockDetectedError) {
            console.error(
              `[StrategyRunner] Block detected, aborting remaining tasks: ${error.reason}`,
            );
            // Stop all remaining work once the website starts blocking requests.
            state.blocked = error.reason;
            await abortRemaining(i, error.reason);
            await reportProgress(totalTasks);
            break;
          }

          // Continue processing the remaining tasks in this lane if one fails.
          const entry = {
            school: {
              name: task.school,
              district: task.district,
              city: task.city,
            },
            error: error.message,
            items: [],
          };
          await state.batchService.add(entry, { isError: true });
          state.completedCount++;
          await reportProgress(totalTasks);

          // Page is about to be recreated at BASE_URL - the next task must
          // do full navigation regardless of city, so forget previousTask.
          previousTask = null;

          // Record the failure and continue processing the remaining tasks.
          try {
            await page.close().catch(() => {});
            page = await browserManager.openPageInContext(context);
          } catch (recreateError) {
            if (recreateError instanceof BlockDetectedError) {
              console.error(
                `[StrategyRunner] Block detected while recreating page, aborting remaining tasks: ${recreateError.reason}`,
              );
              state.blocked = recreateError.reason;
              await abortRemaining(i + 1, recreateError.reason);
              await reportProgress(totalTasks);
              break;
            }
            // Let the next task's own try/catch handle whatever's wrong with the page.
          }
        }
      }

      await page.close().catch(() => {});
    } finally {
      await context.close().catch(() => {});
    }
  }
}

module.exports = StrategyRunner;
