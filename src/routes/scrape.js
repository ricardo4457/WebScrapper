'use strict';

const express = require("express");
const router = express.Router();
const scrapeQueue = require("../queue/ScrapeQueue");
const { isValidStrategy, STRATEGY_NAMES } = require("../strategies/StrategyFactory");

/**
 * Sanity-checks only the fields the /scrape endpoint itself depends on to be
 * able to respond to the caller. Everything else (year, district, city,
 * school, schools...) is strategy-specific and is already validated by the
 * corresponding Strategy constructor inside the worker (see ScrapeTask.js) -
 * duplicating that here would just create a second source of truth.
 *
 * callback_url/run_token are special: if they are missing or malformed,
 * ScrapeCallback.send() silently no-ops (or fails past the worker's
 * try/catch), so the caller would never learn the job failed. That case
 * can't be caught later - it has to be rejected synchronously, here.
 */
function validateScrapeRequest(body) {
  const errors = [];

  if (!body.strategy || typeof body.strategy !== "string") {
    errors.push("'strategy' is required.");
  } else if (!isValidStrategy(body.strategy)) {
    errors.push(
      `Unknown 'strategy' value '${body.strategy}'. Expected one of: ${STRATEGY_NAMES.join(", ")}.`,
    );
  }

  if (!body.callback_url || typeof body.callback_url !== "string") {
    errors.push("'callback_url' is required.");
  } else {
    try {
      new URL(body.callback_url);
    } catch {
      errors.push("'callback_url' must be a valid URL.");
    }
  }

  if (!body.run_token || typeof body.run_token !== "string") {
    errors.push("'run_token' is required.");
  }

  return errors;
}

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

    const validationErrors = validateScrapeRequest(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Invalid scrape request.",
        details: validationErrors,
      });
    }

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