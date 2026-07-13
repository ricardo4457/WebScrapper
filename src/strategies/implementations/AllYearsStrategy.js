'use strict';

const {
  createSchoolSelection,
  createScrapeTask,
  createYearSelection,
  requireNonEmptyArray,
  requireObject,
  uniqueTasks,
} = require('../ScrapeTask');

/**
 * Plans every combination of selected years and schools.
 *
 * Input contract:
 * {
 *   years: [{ year, teaching_cycle }],
 *   schools: [{ district, city, school }]
 * }
 */
class AllYearsStrategy {
  /**
   * @param {object} params Selected years and schools.
   */
  constructor(params = {}) {
    const source = requireObject(params, 'params');
    const years = requireNonEmptyArray(source.years, 'years');
    const schools = requireNonEmptyArray(source.schools, 'schools');
    const tasks = [];

    years.forEach((year, yearIndex) => {
      const yearSelection = createYearSelection(year, `years[${yearIndex}]`);

      schools.forEach((school, schoolIndex) => {
        const selection = createSchoolSelection(school, `schools[${schoolIndex}]`);

        tasks.push(
          createScrapeTask({
            year: yearSelection.year,
            teaching_cycle: yearSelection.teaching_cycle,
            district: school.district,
            city: selection.city,
            school: selection.school,
          }, `schools[${schoolIndex}]`)
        );
      });
    });

    this.tasks = Object.freeze(uniqueTasks(tasks));
  }

  /**
   * @returns {import('../ScrapeTask').ScrapeTask[]}
   */
  getTasks() {
    return [...this.tasks];
  }
}

module.exports = AllYearsStrategy;
