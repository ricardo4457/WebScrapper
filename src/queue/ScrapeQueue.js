const { Queue } = require("bullmq");
const redis = require("../config/redis");

class ScrapeQueue {
    constructor() {
        this.queue = new Queue("book-scraper", {
            connection: redis,
        });
    }

    /**
     * Adds a scraping task to the queue with custom BullMQ options.
     * @param {Object} data - The payload containing url and runId.
     * @param {Object} [options={}] - Optional BullMQ job options (e.g., retries, cleanup).
     * @returns {Promise<Job>} The created BullMQ Job instance.
     */

    async add(data, options = {}) {
        return await this.queue.add("run", data, options);
    }

    /**
     * Finds a job by its unique ID.
     * @param {string} id - The job ID.
     * @returns {Promise<Job|null>}
     */
    
    async find(id) {
        return await this.queue.getJob(id);
    }
}

module.exports = new ScrapeQueue();