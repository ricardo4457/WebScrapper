'use strict';

const StrategyRunner = require("../runner/StrategyRunner");
const scrapeCallback = require("../services/ScrapeCallback");

class ScraperJob {
  /**
   * Main entry point for the BullMQ Worker.
   * 
   * @param {import('bullmq').Job} job 
   */
  async perform(job) {
    const { callback_url, run_token, ...strategyData } = job.data;

    console.log(`[Worker] Processing job ${job.id} for Strategy: ${strategyData.strategy}`);

    try {
      // 1. Run the strategy
      const results = await StrategyRunner.run(strategyData);

      // 2. Dispatch success callback dynamically
      await scrapeCallback.send(
        callback_url,
        {
          status: "completed",
          job_id: job.id,
          results: results,
        },
        run_token
      );

      return results;
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed: ${error.message}`);

      // 3. Dispatch failure callback dynamically
      await scrapeCallback.send(
        callback_url,
        {
          status: "failed",
          job_id: job.id,
          error: error.message,
        },
        run_token
      ).catch((err) => console.error(`[Worker] Failed to send failure callback: ${err.message}`));

      throw error;
    }
  }
}

module.exports = ScraperJob;