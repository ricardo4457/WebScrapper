"use strict";

const { Queue } = require("bullmq");
const redis = require("../config/redis");

// Can be overridden in tests to use an isolated queue.
// Production always uses the default "book-scraper" queue.
const QUEUE_NAME = process.env.SCRAPE_QUEUE_NAME || "book-scraper";

class ScrapeQueue {
  constructor() {
    this.queue = new Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    });
  }

  async add(name, data, options = {}) {
    return await this.queue.add(name, data, options);
  }

  /**
   * Finds a job by its unique ID.
   */
  async find(id) {
    return await this.queue.getJob(id);
  }
}

module.exports = new ScrapeQueue();