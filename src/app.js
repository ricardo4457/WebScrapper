const express = require("express");
const { QueueEvents } = require("bullmq"); // Important: Use QueueEvents to monitor events natively and cleanly!
const scrapeQueue = require("./queue/ScrapeQueue");

const app = express();
app.use(express.json());

// Create the BullMQ queue events listener instance
const queueEvents = new QueueEvents("scrape-queue", {
  // Ensure the name matches your queue
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

app.post("/scrape/run", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Por favor, fornece um URL." });
    }

    // 1. Add the job to the queue with automatic cleanup (Good Redis memory practice!)
    const job = await scrapeQueue.add(
      "scrape-task", // BullMQ requires the job name as the first argument
      { url },
      {
        removeOnComplete: { count: 50 }, // Prevent Redis memory from filling up
        removeOnFail: { count: 100 },
      },
    );

    //console.log(`[API] Job ${job.id} adicionado à fila.`);

    // 2. Wait natively using BullMQ API (waitUntilFinished) tied to the queue event monitor
    // Note: Passing `queueEvents` helps BullMQ reliably receive the Redis event.
    const result = await job.waitUntilFinished(queueEvents);

    //console.log(`[API] Job ${job.id} concluído com sucesso!`);

    // 3. Send response back
    return res.status(200).json({
      success: true,
      message: "Scraping realizado com sucesso!",
      jobId: job.id,
      data: result,
    });
  } catch (error) {
    console.error("Erro ao processar o scraping:", error);
    return res.status(500).json({
      success: false,
      error: "Ocorreu um erro ao processar o scraping no Worker.",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  //console.log(` API ativa na porta ${PORT}`);
});