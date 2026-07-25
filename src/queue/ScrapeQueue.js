"use strict";

const { Queue } = require("bullmq");
const redis = require("../config/redis");

class ScrapeQueue {
  constructor() {
    this.queue = new Queue("book-scraper", {
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