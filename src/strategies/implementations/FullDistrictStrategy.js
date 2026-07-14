'use strict';

const {
  createSchoolSelection,
  createScrapeTask,
  optionalText,
  requireNonEmptyArray,
  requireObject,
  requireText,
  uniqueTasks,
} = require('../ScrapeTask');

/**
 * Plans one task for every selected school in one district and school year.
 *
 * Input contract:
 * { year, teaching_cycle, district, schools: [{ city, school }] }
 */
class FullDistrictStrategy {
  /**
   * @param {object} params District, year, and selected schools.
   */
  constructor(params = {}) {
    const source = requireObject(params, 'params');
    const year = requireText(source.year, 'year');
    const teachingCycle = optionalText(source.teaching_cycle, 'teaching_cycle');
    const district = requireText(source.district, 'district');
    const schools = requireNonEmptyArray(source.schools, 'schools');

    const tasks = schools.map((school, index) => {
      const selection = createSchoolSelection(school, `schools[${index}]`);

      return createScrapeTask({
        year,
        teaching_cycle: teachingCycle,
        district,
        city: selection.city,
        school: selection.school,
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

module.exports = FullDistrictStrategy;
