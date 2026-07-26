"use strict";

const {
  createScrapeTask,
  createYearSelection,
  requireText,
  uniqueTasks,
} = require("../ScrapeTask");
const scraper = require("../../scrapper/scraper");
const SEL = require("../../scrapper/selectors");
const {
  assertNotBlocked,
  BlockDetectedError,
} = require("../../scrapper/blockDetection");

/**
 * Discovers every school in a single city (city, within a district) and
 * creates one scraping task per school found.

 */
class FullCityStrategy {
  constructor(params = {}) {
    this.yearSelection = createYearSelection(params, "params");
    this.district = requireText(params.district, "district");
    this.city = requireText(params.city, "city");
    // Stores discovered tasks to avoid repeating the discovery process.
    this.tasks = null;
  }

  /**
   * Navigates through the given district/city to build the list of
   * scraping tasks for that city's schools.
   */
  async getTasks(page) {
    if (this.tasks) {
      return [...this.tasks];
    }

    if (!page) {
      throw new Error(
        "FullCityStrategy.getTasks: a live page is required to discover schools.",
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

    const schools = await scraper.discoverSchools(page);
    const tasks = schools.map((school) =>
      createScrapeTask({
        year: this.yearSelection.year,
        teaching_cycle: this.yearSelection.teaching_cycle,
        district: this.district,
        city: this.city,
        school,
      }),
    );

    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await scraper.waitForLoadingToFinish(page);

    await assertNotBlocked(page, response);

    this.tasks = Object.freeze(uniqueTasks(tasks));
    return [...this.tasks];
  }

  // Try to reuse the current navigation when scraping another
  // school in the same city.
  async execute(page, task, { sameLocation = false } = {}) {
    if (sameLocation) {
      try {
        await scraper.returnToSchoolSelection(page);
        return await scraper.scrapeSchool(page, task);
      } catch (fastPathError) {
        if (fastPathError instanceof BlockDetectedError) throw fastPathError;
        console.error("[DEBUG] Fast path failed with error:", fastPathError);
        console.warn(
          `[FullCityStrategy] Same-city fast path failed for "${task.school}" ` +
            `(${fastPathError.message}). Falling back to full navigation.`,
        );
      }
    }
    await scraper.waitForLoadingToFinish(page);
    await scraper.navigateToLocation(page, task);
    return scraper.scrapeSchool(page, task);
  }
}

module.exports = FullCityStrategy;