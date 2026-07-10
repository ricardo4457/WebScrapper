const { Worker } = require("bullmq");

const { runStrategy } = require("./strategies");

const ScrapeJob = require("./jobs/ScrapeJob");

const callbackService = require("./services/CallbackService");

const redis = require("./config/redis");


new Worker(
  "book-scraper",

  async (job) => {

    const scrapeJob = new ScrapeJob(
      job.data,
      job
    );


    try {

      const books = await runStrategy(
        scrapeJob.getStrategyData(),
        (progress) =>
          scrapeJob.updateProgress(progress)
      );


      await callbackService.send(
        scrapeJob.callbackUrl,
        scrapeJob.getCompletedPayload(books)
      );


      return {
        status: "completed",
      };


    } catch (error) {


      await callbackService.send(
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