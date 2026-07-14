'use strict';

/**
 * Wraps one BullMQ job's raw data with the helpers the Worker needs:
 * building the strategy input, reporting progress, and building the
 * callback payloads sent to the Laravel API.
 */
class ScrapeJob {
    constructor(data, bullJob) {
        this.bullJob = bullJob;

        this.strategy = data.strategy;
        this.year = data.year;
        this.teachingCycle = data.teaching_cycle;
        this.district = data.district;
        this.city = data.city;
        this.school = data.school;
        this.schools = data.schools; // array [{ city, school }] - só usado por full_district

        this.callbackUrl = data.callback_url;
        this.runToken = data.run_token;
    }

    /** Builds the input object expected by runStrategy()/createStrategy(). */
    getStrategyData() {
        if (this.strategy === 'full_district') {
            return {
                strategy: this.strategy,
                year: this.year,
                teaching_cycle: this.teachingCycle,
                district: this.district,
                schools: this.schools,
            };
        }

        return {
            strategy: this.strategy,
            year: this.year,
            teaching_cycle: this.teachingCycle,
            district: this.district,
            city: this.city,
            school: this.school,
        };
    }

    /**
     * @param {Array<{ task: object, books: object[] }>} results Output of runStrategy().
     */
    getCompletedPayload(results) {
        return {
            run_token: this.runToken,
            job_token: this.bullJob.id.toString(),
            status: "completed",

            books: results.map(({ task, books }) => ({
                school: {
                    name: task.school,
                    district: task.district,
                    city: task.city,
                },
                year: task.year,
                teaching_cycle: task.teaching_cycle,
                items: books,
            })),
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