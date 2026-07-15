'use strict';

const express = require("express");
const router = express.Router();
const scrapeQueue = require("../queue/ScrapeQueue");

router.post("/", async (req, res) => {
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

    // Add job to the queue. 
    // Note: BullMQ `.add` takes ('jobName', dataPayload, options)
    const job = await scrapeQueue.add(
      "scrape-job", 
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

    // 🌟 RETURN PLURAL ARRAY & TOTAL JOBS TO SATISFY LARAVEL
    return res.status(202).json({
      job_tokens: [job.id.toString()], 
      jobs_total: 1,                  
      status: "queued",
    });

  } catch (error) {
    console.error(`[Router] Error queuing job: ${error.message}`);
    return res.status(500).json({
      error: "Failed to queue the scraping task",
    });
  }
});

router.get("/:id", async (req, res) => {
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