'use strict';

const scrapeCallback = require("../services/ScrapeCallback");

class ScraperJob {
  /**
   * Main entry point for the BullMQ Worker.
   */
  async perform(job) {
    const { callback_url, run_token, ...strategyData } = job.data;

    console.log(`[Worker] Processing job ${job.id} for Strategy: ${strategyData.strategy}`);

    try {
      // 1. Mark as started
      await job.updateProgress(10); //

      // 2. Run the strategy
      const results = await StrategyRunner.run(strategyData);
      
      // Mark progress as near complete before the callback
      await job.updateProgress(90); //

      // 3. Dispatch success callback dynamically
      await scrapeCallback.send(
        callback_url,
        {
          status: "completed",
          job_id: job.id,
          results: results,
        },
        run_token
      );

      await job.updateProgress(100); //
      return results;
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed: ${error.message}`);

      // 4. Dispatch failure callback dynamically
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