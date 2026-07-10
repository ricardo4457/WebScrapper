class ScrapeJobPayload {
    constructor(data) {
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


    getStrategyInput() {
        return {
            strategy: this.strategy,
            year: this.year,
            teaching_cycle: this.teachingCycle,
            district: this.school.district,
            city: this.school.city,
            school: this.school.name,
        };
    }


    getCallbackPayload(books) {
        return {
            run_token: this.runToken,

            status: "completed",

            books: [
                {
                    school: this.school,
                    items: books,
                },
            ],
        };
    }


    getFailurePayload(error) {
        return {
            run_token: this.runToken,
            status: "failed",
            error: error.message,
        };
    }
}


module.exports = ScrapeJobPayload;