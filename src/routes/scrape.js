'use strict';

const express = require("express");
const router = express.Router();
const scrapeQueue = require("../queue/ScrapeQueue");

router.post("/scrape/run", async (req, res) => {
  try {
    const {
      strategy,
      year,
      teaching_cycle,
      district,
      city,
      school,
      schools, 
      callback_url,
      run_token, // Received dynamically from Laravel
    } = req.body;

    // Add job to the queue with the dynamic run_token included in payload
    const job = await scrapeQueue.add(
      {
        strategy,
        year,
        teaching_cycle,
        district,
        city,
        school,
        schools,
        callback_url,
        run_token, 
      },
      {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      }
    );

    return res.status(202).json({
      job_token: job.id.toString(),
      status: "queued",
    });
  } catch (error) {
    console.error(`[Router] Error queuing job: ${error.message}`);
    return res.status(500).json({
      error: "Failed to queue the scraping task",
    });
  }
});

router.get("/scrape/run/:id", async (req, res) => {
  try {
    const job = await scrapeQueue.find(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.json({
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
    });
  } catch (error) {
    console.error(`[Router] Error fetching job status: ${error.message}`);
    return res.status(500).json({
      error: "Failed to fetch job status",
    });
  }
});

module.exports = router;