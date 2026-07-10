const BaseStrategy = require('./BaseStrategy');

/**
 * SingleSchoolStrategy
 *
 * Generates a single scraping task for a specific school.
 *
 * Expected input:
 * {
 *   year: '4',
 *   teaching_cycle: 'Primary',
 *   district: 'Porto',
 *   city: 'Valongo',
 *   school: 'Colégio de Ermesinde - Escola Católica'
 * }
 */
class SingleSchoolStrategy extends BaseStrategy {

    constructor(params = {}) {
        super();

        this.validate(params);

        this.params = params;
    }

    validate({ year, district, city, school }) {

        const missing = [
            'year',
            'district',
            'city',
            'school',
        ].filter(field => !arguments[0][field]);

        if (missing.length) {
            throw new Error(
                `SingleSchoolStrategy: Missing required fields: ${missing.join(', ')}`
            );
        }
    }

    /**
     * Returns the scraping tasks.
     */
    getTasks() {

        const {
            year,
            teaching_cycle = null,
            district,
            city,
            school,
        } = this.params;

        return [
            {
                year,
                teaching_cycle,
                district,
                city,
                school,
            },
        ];
    }

    /**
     * Description for logging.
     */
    describe() {

        const {
            year,
            teaching_cycle,
            district,
            city,
            school,
        } = this.params;

        return {
            type: 'SingleSchool',
            year,
            teaching_cycle,
            district,
            city,
            school,
        };
    }
}

module.exports = SingleSchoolStrategy;