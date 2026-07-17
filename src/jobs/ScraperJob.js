"use strict";

const StrategyRunner = require("../runner/StrategyRunner");

class ScraperJob {
  /**
   * Main entry point for the BullMQ Worker.
   * Runs the strategy and returns the result - the callback to Laravel
   * is handled in the JobRunner, within the worker.on("completed"/"failed") events.
   */
  async perform(job) {
    const { strategy: strategyName, ...rest } = job.data;

    console.log(
      `[Worker] Processing job ${job.id} for Strategy: ${strategyName}`,
    );
    console.log(`[Worker] Job data: ${JSON.stringify(job.data)}`);

    await job.updateProgress(10);
    const results = await StrategyRunner.run(job.data);
    await job.updateProgress(100);

    return results;
  }
}

module.exports = ScraperJob;
