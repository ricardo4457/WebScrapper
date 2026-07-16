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
      run_token,
    } = req.body;

    // We pass 'scrape-job' as the name, the data payload, and the options
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
    // Use getJob instead of find to match standard BullMQ API
    const job = await scrapeQueue.queue.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    // Get current state and progress from the job object
    const state = await job.getState();
    const progress = job.progress;

    return res.json({
      id: job.id,
      state: state,
      progress: progress,
    });
  } catch (error) {
    console.error(`[Router] Error fetching job status: ${error.message}`);
    return res.status(500).json({
      error: "Failed to fetch job status",
    });
  }
});

module.exports = router;