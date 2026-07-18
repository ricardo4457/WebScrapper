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

  // Handle unexpected worker results.
  if (!Array.isArray(returnValue)) {
    console.error(
      ` Job ${job.id} devolveu um resultado inesperado (não é array):`,
      returnValue,
    );
    try {
      await scrapeCallback.send(
        callback_url,
        {
          status: "failed",
          job_token: job.id,
          books: [],
          error:
            "Resultado do worker em formato inesperado - ver logs do scraper-worker.",
        },
        run_token,
      );
    } catch (error) {
      console.error(` Erro no callback para job ${job.id}:`, error.message);
    }
    return;
  }

  const failedEntries = returnValue.filter((entry) => entry?.error);
  const hasError = failedEntries.length > 0;

  console.log(
    hasError
      ? ` Job ${job.id} terminou com erro em ${failedEntries.length}/${returnValue.length} escola(s).`
      : ` Job ${job.id} concluído.`,
  );

  // Log failed schools.
  if (hasError) {
    failedEntries.forEach((entry) => {
      console.error(`   ↳ ${entry.school?.name}: ${entry.error}`);
    });
  }

  try {
    // Send the job result to the API.
    await scrapeCallback.send(
      callback_url,
      {
        status: hasError ? "failed" : "completed",
        job_token: job.id,
        books: returnValue,
        // Log callback failures.
        error: hasError
          ? failedEntries.map((e) => `${e.school?.name}: ${e.error}`).join("; ")
          : undefined,
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
  }
  // Keep the worker running for the next jobs.
});

worker.on("failed", async (job, err) => {
  console.error(` Job ${job.id} failed: ${err.message}`);

  const { callback_url, run_token } = job.data;

  try {
    // Notify the API that the job failed.
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

// Handle worker-level errors.
worker.on("error", (err) => {
  console.error(" [JobRunner] Erro de conexão/Worker:", err.message);
});

// Gracefully shut down the worker.
async function shutdown(signal) {
  console.log(`[JobRunner] ${signal} recebido, a encerrar worker...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));