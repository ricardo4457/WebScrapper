"use strict";

const StrategyRunner = require("../runner/StrategyRunner");

class ScraperJob {
/**
 * Runs the scraping strategy.
 * Callback handling is done by the JobRunner.
 */
  async perform(job) {
    const { strategy: strategyName, ...rest } = job.data;

    console.log(
      `[Worker] Processing job ${job.id} for Strategy: ${strategyName}`,
    );
    console.log(`[Worker] Job data: ${JSON.stringify(job.data)}`);

    await job.updateProgress(0);

    const results = await StrategyRunner.run(job.data, {
      onProgress: async (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
        await job.updateProgress(percent);
        console.log(
          `[Worker] Job ${job.id} progress: ${completed}/${total} (${percent}%)`,
        );
      },
    });

    await job.updateProgress(100);

    return results;
  }
}

module.exports = ScraperJob;
