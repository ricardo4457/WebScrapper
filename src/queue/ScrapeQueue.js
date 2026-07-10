const { Queue } = require("bullmq");
const redis = require("../config/redis");


class ScrapeQueue {

    constructor() {
        this.queue = new Queue(
            "book-scraper",
            {
                connection: redis,
            }
        );
    }


    async add(data) {

        return await this.queue.add(
            "run",
            data
        );

    }


    async find(id) {

        return await this.queue.getJob(id);

    }
}


module.exports = new ScrapeQueue();