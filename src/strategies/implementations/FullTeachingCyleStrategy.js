"use strict";

const {
  createScrapeTask,
  createYearSelection,
  requireText,
  uniqueTasks,
} = require("../ScrapeTask");
const scraper = require("../../scrapper/scraper");
const SEL = require("../../scrapper/selectors");
const { assertNotBlocked } = require("../../scrapper/blockDetection");
const { timed } = require("../../utils/RunTimings");

/**
 * Discovers all course-specific tasks for a school.
 */

class FullTeachingCyleStrategy {
  constructor(params = {}) {
    this.yearSelection = createYearSelection(params, "params");
    this.school = requireText(params.school, "school");
    this.district = requireText(params.district, "district");
    this.city = requireText(params.city, "city");
    // Cache discovered tasks to avoid repeating discovery.
    this.tasks = null;
  }

  /**
   * Builds the scraping tasks for the configured school.
   */
  async getTasks(page) {
    if (this.tasks) {
      return [...this.tasks];
    }

    if (!page) {
      throw new Error(
        "FullTeachingCyleStrategy.getTasks: a live page is required to discover schools.",
      );
    }

    await scraper.selectYearAndCycle(page, {
      yearLabel: this.yearSelection.year,
      teachingType: this.yearSelection.teaching_cycle,
    });
    await scraper.selectDistrict(page, this.district);
    await assertNotBlocked(page);
    await scraper.selectCity(page, this.city);
    await assertNotBlocked(page);
    await scraper.selectSchool(page, this.school);
    await assertNotBlocked(page);

    const tasks = [];

    const courses = await scraper.discoverCourses(page);

    // One task per discovered course.
    for (const course of courses) {
      tasks.push(
        createScrapeTask({
          year: this.yearSelection.year,
          teaching_cycle: this.yearSelection.teaching_cycle,
          district: this.district,
          city: this.city,
          school: this.school,
          course: course,
        }),
      );
    }

    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await scraper.waitForLoadingToFinish(page);
    await assertNotBlocked(page, response);

    this.tasks = Object.freeze(uniqueTasks(tasks));
    return [...this.tasks];
  }

  async execute(page, task) {
    // Reset the page before each task because the same page is reused.
    await timed(page, "navigation", () => scraper.resetToBasePage(page));
    await scraper.waitForLoadingToFinish(page);
    await scraper.navigateToLocation(page, task);
    const books = await scraper.scrapeSchool(page, task);
    return books;
  }
}

module.exports = FullTeachingCyleStrategy;
