'use strict';

const { Queue } = require("bullmq");
const redis = require("../config/redis");

class ScrapeQueue {
    constructor() {
        this.queue = new Queue("book-scraper", {
            connection: redis,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { age: 3600, count: 1000 }, // limpa jobs completos após 1h (máx 1000 guardados)
                removeOnFail: { age: 86400 },                  // guarda falhas 24h para debug, depois limpa
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