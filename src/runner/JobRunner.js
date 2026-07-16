const { Worker } = require("bullmq");
const redis = require("../config/redis");
const ScraperJob = require("../jobs/ScraperJob");

console.log(" Job Runner is starting...");

const worker = new Worker(
  "book-scraper",
  async (job) => {
    console.log(
      `[JobRunner] Started job ${job.id} for strategy: ${job.data.strategy}`,
    );

    try {
      // Execute the scraping logic
      // *Note: Adjust this method call based on how ScraperJob is actually exported
      return await ScraperJob.execute(job.data);
    } catch (error) {
      console.error(`[JobRunner] Error in job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  },
);
worker.on("completed", async (job, returnValue) => {
  console.log(` Job ${job.id} concluído.`);
  try {
    await axios.post(job.data.callback_url, {
      run_token: job.data.run_token,
      job_token: job.data.job_token,
      status: "completed",
      books: returnValue, // Envia o objeto formatado com school e items
    });
  } catch (error) {
    console.error(` Erro no callback:`, error.message);
  }
});

// Evento de Erro
worker.on("failed", async (job, err) => {
  console.error(` Job ${job.id} failed: ${err.message}`);

  try {
    await axios.post(job.data.callback_url, {
      run_token: job.data.run_token, // Obrigatório pelo ScrapeCallbackRequest
      job_token: job.id.toString(),
      status: "failed",
      error: err.message,
    });
  } catch (error) {
    console.error(
      ` Failed to send failure callback for ${job.id}:`,
      error.message,
    );
  }
});
