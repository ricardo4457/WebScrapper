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
 * Discovers all schools in a district by navigating through the website
 * and creates one scraping task for each school found.
 */
class FullDistrictStrategy {
  constructor(params = {}) {
    this.yearSelection = createYearSelection(params, "params");
    this.district = requireText(params.district, "district");
    // Stores discovered tasks to avoid repeating the discovery process.
    this.tasks = null;
  }

  /**
   * Navigates through the available cities and schools to build
   * the list of scraping tasks.
   */
  async getTasks(page) {
    if (this.tasks) {
      return [...this.tasks];
    }

    if (!page) {
      // Retrieve all cities available for the selected district.
      throw new Error(
        "FullDistrictStrategy.getTasks: a live page is required to discover cities/schools.",
      );
    }

    await scraper.selectYearAndCycle(page, {
      yearLabel: this.yearSelection.year,
      teachingType: this.yearSelection.teaching_cycle,
    });
    await scraper.selectDistrict(page, this.district);
    await assertNotBlocked(page);

    const cities = await scraper.discoverCities(page);
    const tasks = [];
    // Retrieve all schools for the current city.
    for (const city of cities) {
      await scraper.selectCity(page, city);
      await assertNotBlocked(page);
      // Return to the homepage before starting the scraping process.
      const schools = await scraper.discoverSchools(page);
      for (const school of schools) {
        tasks.push(
          createScrapeTask({
            year: this.yearSelection.year,
            teaching_cycle: this.yearSelection.teaching_cycle,
            district: this.district,
            city,
            school,
          }),
        );
      }
    }

    // Remove duplicate tasks and cache the result.
    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await scraper.BrowserManager.waitForLoadingToFinish(page);

    await assertNotBlocked(page, response);

    this.tasks = Object.freeze(uniqueTasks(tasks));
    return [...this.tasks];
  }

  // Try to reuse the current navigation when scraping
  // another school in the same city.
  async execute(page, task, { sameLocation = false } = {}) {
    if (sameLocation) {
      try {
        await scraper.returnToSchoolSelection(page);
        return await scraper.scrapeSchool(page, task);
      } catch (fastPathError) {
        // If the fast path fails, perform the full navigation instead.
        if (fastPathError instanceof BlockDetectedError) throw fastPathError;
        console.warn(
          `[FullDistrictStrategy] Same-city fast path failed for "${task.school}" ` +
            `(${fastPathError.message}). Falling back to full navigation.`,
        );
      }
    }
    await scraper.BrowserManager.waitForLoadingToFinish(page);
    await scraper.navigateToLocation(page, task);
    return scraper.scrapeSchool(page, task);
  }
}

module.exports = FullDistrictStrategy;
