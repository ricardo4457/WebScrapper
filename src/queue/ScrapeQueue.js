'use strict';

const { Queue } = require("bullmq");
const redis = require("../config/redis");

class ScrapeQueue {
    constructor() {
        this.queue = new Queue("book-scraper", {
            connection: redis,
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