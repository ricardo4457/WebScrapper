"use strict";

const StrategyRunner = require("../runner/StrategyRunner");

class ScraperJob {
  /**
   * Runs the scraping strategy.
   * Results are streamed to Laravel progressively (see ResultBatchService),
   * Returns a summary for JobRunner to build the final callback
   */
  async perform(job) {
    const { strategy: strategyName, ...rest } = job.data;

    console.log(
      `[Worker] Processing job ${job.id} for Strategy: ${strategyName}`,
    );
    console.log(`[Worker] Job data: ${JSON.stringify(job.data)}`);

    await job.updateProgress(0);

    const summary = await StrategyRunner.run(job.data, {
      jobToken: job.id,
      attempt: job.attemptsMade,
      onProgress: async (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
        await job.updateProgress(percent);
        console.log(
          `[Worker] Job ${job.id} progress: ${completed}/${total} (${percent}%)`,
        );
      },
    });

    await job.updateProgress(100);

    return summary;
  }
}

module.exports = ScraperJob;