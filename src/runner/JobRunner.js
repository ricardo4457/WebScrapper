const { Worker, UnrecoverableError } = require("bullmq");
const redis = require("../config/redis");
const ScraperJob = require("../jobs/ScraperJob");
const scrapeCallback = require("../services/ScrapeCallback");

// Must use the same queue name as src/queue/ScrapeQueue.js;
// otherwise this worker will not consume jobs created by the /scrape route.
const QUEUE_NAME = process.env.SCRAPE_QUEUE_NAME || "book-scraper";

console.log("Job Runner is starting...");

const scraperJob = new ScraperJob();

const worker = new Worker(
  QUEUE_NAME,
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

  // Results were already streamed in batches during execution.
  // Only a completion signal and failure summary are returned.

  // Handle unexpected worker results.
  const isValidSummary =
    returnValue &&
    typeof returnValue === "object" &&
    Array.isArray(returnValue.failedEntries);

  if (!isValidSummary) {
    console.error(
      `Job ${job.id} returned an unexpected result (invalid summary format):`,
      returnValue,
    );

    try {
      await scrapeCallback.send(
        callback_url,
        {
          status: "failed",
          job_token: job.id,
          attempt: job.attemptsMade,
          books: [],
          final: true,
          error:
            "Worker returned an unexpected result format. Check the scraper-worker logs.",
        },
        run_token,
      );
    } catch (error) {
      console.error(
        `Failed to send callback for job ${job.id}:`,
        error.message,
      );
    }

    return;
  }

  const { sentCount, failedEntries } = returnValue;
  const hasError = failedEntries.length > 0;

  console.log(
    hasError
      ? `Job ${job.id} completed with errors in ${failedEntries.length} school(s) (${sentCount} successfully sent in total).`
      : `Job ${job.id} completed successfully (${sentCount} school(s) sent).`,
  );

  // Log failed schools.
  if (hasError) {
    failedEntries.forEach((entry) => {
      console.error(`   ↳ ${entry.school?.name}: ${entry.error}`);
    });
  }

  try {
    await scrapeCallback.send(
      callback_url,
      {
        status: hasError ? "failed" : "completed",
        job_token: job.id,
        attempt: job.attemptsMade,
        books: failedEntries,
        final: true,
        error: hasError
          ? failedEntries.map((e) => `${e.school?.name}: ${e.error}`).join("; ")
          : undefined,
      },
      run_token,
    );
  } catch (error) {
    // Log callback failures.
    console.error(`Failed to send callback for job ${job.id}:`, error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response body:", JSON.stringify(error.response.data));
    }
  }

  // Keep the worker running for the next jobs.
});

worker.on("failed", async (job, err) => {
  const maxAttempts = job.opts?.attempts ?? 1;

  const isFinalAttempt =
    job.attemptsMade >= maxAttempts || err instanceof UnrecoverableError;

  if (!isFinalAttempt) {
    console.warn(
      `Job ${job.id} attempt ${job.attemptsMade}/${maxAttempts} failed: ${err.message}. Retry scheduled; Laravel will not be notified yet.`,
    );
    return;
  }

  console.error(
    `Job ${job.id} failed permanently after ${job.attemptsMade} attempt(s): ${err.message}`,
  );

  const { callback_url, run_token } = job.data;

  try {
    // Notify the API that the job failed.
    await scrapeCallback.send(
      callback_url,
      {
        status: "failed",
        job_token: job.id,
        attempt: job.attemptsMade,
        books: [],
        final: true,
        error: err.message,
      },
      run_token,
    );
  } catch (error) {
    console.error(
      `Failed to send failure callback for job ${job.id}:`,
      error.message,
    );
  }
});

// Handle worker-level errors.
worker.on("error", (err) => {
  console.error("[JobRunner] Worker/connection error:", err.message);
});

// Gracefully shut down the worker.
async function shutdown(signal) {
  console.log(`[JobRunner] Received ${signal}, shutting down worker...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Exportado apenas para permitir aos testes de integração fechar a ligação
// (worker.close()) no afterAll. Não afeta o uso normal via `node src/runner/JobRunner.js`.
module.exports = worker;