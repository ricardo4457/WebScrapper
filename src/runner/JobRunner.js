const { Worker } = require("bullmq");
const redis = require("../config/redis");
const ScraperJob = require("../jobs/ScraperJob");
const scrapeCallback = require("../services/ScrapeCallback");

console.log(" Job Runner is starting...");

const scraperJob = new ScraperJob();

const worker = new Worker(
  "book-scraper",
  async (job) => {
    console.log(
      `[JobRunner] Started job ${job.id} for strategy: ${job.data.strategy}`,
    );
    return scraperJob.perform(job);
  },
  {
    connection: redis,
    concurrency: 2,
  },
);

worker.on("completed", async (job, returnValue) => {
  const { callback_url, run_token } = job.data;
  const hasError = returnValue?.error != null;

  console.log(
    hasError
      ? ` Job ${job.id} terminou com erro de scraping.`
      : ` Job ${job.id} concluído.`,
  );

  try {
    // Send results back to the application via callback
    await scrapeCallback.send(
      callback_url,
      {
        status: hasError ? "failed" : "completed",
        job_token: job.id,
        results: returnValue,
        error_message: hasError ? returnValue.error : undefined,
      },
      run_token,
    );
  } catch (error) {
    // Log failures in the callback process itself
    console.error(` Erro no callback para job ${job.id}:`, error.message);
    if (error.response) {
      console.error(" Status:", error.response.status);
      console.error(" Body:", JSON.stringify(error.response.data));
    }
  } finally {
    // Close worker connection after processing
    await worker.close();
  }
});

worker.on("failed", async (job, err) => {
  console.error(` Job ${job.id} failed: ${err.message}`);

  const { callback_url, run_token } = job.data;

  try {
    // Notify application of catastrophic job failure
    await scrapeCallback.send(
      callback_url,
      {
        status: "failed",
        job_token: job.id,
        error: err.message,
      },
      run_token,
    );
  } catch (error) {
    console.error(
      ` Failed to send failure callback for job ${job.id}:`,
      error.message,
    );
  }
});
