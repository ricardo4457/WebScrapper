class ScrapeJob {
    constructor(data, bullJob) {
        this.bullJob = bullJob;

        this.strategy = data.strategy;
        this.year = data.year;
        this.teachingCycle = data.teaching_cycle;

        this.school = {
            name: data.school,
            district: data.district,
            city: data.city,
        };

        this.callbackUrl = data.callback_url;
        this.runToken = data.run_token;
    }


    getStrategyData() {
        return {
            strategy: this.strategy,
            year: this.year,
            teaching_cycle: this.teachingCycle,
            district: this.school.district,
            city: this.school.city,
            school: this.school.name,
        };
    }


    getCompletedPayload(books) {
        return {
            run_token: this.runToken,
            job_token: this.bullJob.id.toString(),
            status: "completed",

            books: [
                {
                    school: this.school,
                    items: books,
                },
            ],
        };
    }


    getFailedPayload(error) {
        return {
            run_token: this.runToken,
            job_token: this.bullJob.id.toString(),
            status: "failed",
            error: error.message,
        };
    }


    updateProgress(progress) {
        return this.bullJob.updateProgress(progress);
    }
}

module.exports = ScrapeJob;