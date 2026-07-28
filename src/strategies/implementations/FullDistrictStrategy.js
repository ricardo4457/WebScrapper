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
const DiscoveryRunner = require("../../runner/DiscoveryRunner");
const { timed } = require("../../utils/RunTimings");

// Maximum number of parallel browser contexts used during school discovery.
const MAX_DISCOVERY_LANES = 4;

/**
 * Discovers all schools in a district and creates
 * a scraping task for each one found.
 */

class FullDistrictStrategy {
  constructor(params = {}) {
    this.yearSelection = createYearSelection(params, "params");
    this.district = requireText(params.district, "district");
    // Remove duplicate tasks and cache the result.
    this.tasks = null;
  }

  /**
   * Discovers all cities in the selected district and generates
   * the corresponding scraping tasks.
   *
   * City discovery is sequential, while school discovery
   * is executed in parallel using DiscoveryRunner.
   */

  async getTasks(page, { browserManager } = {}) {
    if (this.tasks) {
      return [...this.tasks];
    }

    if (!page) {
      throw new Error(
        "FullDistrictStrategy.getTasks: a live page is required to discover cities/schools.",
      );
    }
    if (!browserManager) {
      throw new Error(
        "FullDistrictStrategy.getTasks: a browserManager is required to parallelize school discovery.",
      );
    }

    // Selects the year, cycle and district for a browser page.

    const selectYearCycleAndDistrict = async (targetPage) => {
      await scraper.selectYearAndCycle(targetPage, {
        yearLabel: this.yearSelection.year,
        teachingType: this.yearSelection.teaching_cycle,
      });
      await scraper.selectDistrict(targetPage, this.district);
      await assertNotBlocked(targetPage);
    };

    // Load all available cities for the selected district.
    await selectYearCycleAndDistrict(page);

    const cities = await scraper.discoverCities(page);

    // Reset the page before starting parallel discovery.
    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await scraper.waitForLoadingToFinish(page);
    await assertNotBlocked(page, response);

    const tasks = await DiscoveryRunner.run(cities, {
      browserManager,
      laneCount: MAX_DISCOVERY_LANES,
      // Runs once for each browser lane.
      setupLane: selectYearCycleAndDistrict,
      // Discovers all schools for a single city.
      discoverUnit: async (lanePage, city) => {
        await scraper.selectCity(lanePage, city);
        await assertNotBlocked(lanePage);

        const schools = await scraper.discoverSchools(lanePage);
        return schools.map((school) =>
          createScrapeTask({
            year: this.yearSelection.year,
            teaching_cycle: this.yearSelection.teaching_cycle,
            district: this.district,
            city,
            school,
          }),
        );
      },
    });

    // Remove duplicate tasks and cache the result.
    this.tasks = Object.freeze(uniqueTasks(tasks));
    return [...this.tasks];
  }

  /**
   * Executes the scraping task.
   *
   * Reuses the current navigation when scraping another
   * school from the same city to improve performance.
   */
  async execute(page, task, { sameLocation = false } = {}) {
    if (sameLocation) {
      try {
        await scraper.returnToSchoolSelection(page);
        return await scraper.scrapeSchool(page, task);
      } catch (fastPathError) {
        // Fall back to full navigation if the fast path fails.
        if (fastPathError instanceof BlockDetectedError) throw fastPathError;
        console.error("[DEBUG] Fast path failed with error:", fastPathError);
        console.warn(
          `[FullDistrictStrategy] Same-city fast path failed for "${task.school}" ` +
            `(${fastPathError.message}). Falling back to full navigation.`,
        );
      }
    }
    await timed(page, "navigation", () => scraper.waitForLoadingToFinish(page));
    await scraper.navigateToLocation(page, task);
    return scraper.scrapeSchool(page, task);
  }
}

module.exports = FullDistrictStrategy;
