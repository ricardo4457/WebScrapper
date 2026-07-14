const { Worker } = require("bullmq");

const { StrategyRunner } = require("./StrategyRunner");

const ScrapeJob = require("../jobs/ScraperJob");

const callbackService = require("../services/ScrapeCallback");

const redis = require("../config/redis");


new Worker(
  "book-scraper",

  async (job) => {

    const scrapeJob = new ScrapeJob(
      job.data,
      job
    );


    try {

      const results = await StrategyRunner(
        scrapeJob.getStrategyData(),
        (progress) =>
          scrapeJob.updateProgress(progress)
      );


      await callbackService.completed(
        scrapeJob.callbackUrl,
        scrapeJob.getCompletedPayload(results)
      );


      return {
        status: "completed",
      };


    } catch (error) {


      await callbackService.failed(
        scrapeJob.callbackUrl,
        scrapeJob.getFailedPayload(error)
      );


      throw error;
    }

  },


  {
    connection: redis,
  }
);