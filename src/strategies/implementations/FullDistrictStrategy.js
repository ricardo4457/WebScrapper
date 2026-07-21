"use strict";

const { createScrapeTask, createYearSelection, requireText, uniqueTasks } = require("../ScrapeTask");
const scraper = require("../../scrapper/scraper");
const SEL = require("../../scrapper/selectors");
const { assertNotBlocked } = require("../../scrapper/blockDetection");

/**
 * Discovers every {city, school} pair in a district live, by walking the
 * wook.pt combos, then runs the same single-school flow for each.
 *
 * getTasks() is async and needs an already-open Playwright page —
 * StrategyRunner launches the browser and opens the base page before
 * calling getTasks(page), then reuses that same page for execute(). This
 * replaces the earlier design that required the caller to already know
 * and pass in the full {city, school} list.
 *
 * Expected params:
 *   {
 *     year: '4.º',
 *     teaching_cycle: 'Ensino Básico (1º Ciclo)', // optional
 *     district: 'Porto',
 *   }
 */
class FullDistrictStrategy {
  constructor(params = {}) {
    this.yearSelection = createYearSelection(params, "params");
    this.district = requireText(params.district, "district");
    this.tasks = null; // populated by getTasks(page), memoized after first call
  }

  /**
   * Walks year/cycle -> district -> every city -> every school, building
   * one task per {city, school} pair found. Must run before execute().
   */
  async getTasks(page) {
    if (this.tasks) {
      return [...this.tasks];
    }

    if (!page) {
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

    for (const city of cities) {
      await scraper.selectCity(page, city);
      await assertNotBlocked(page);

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

    // Discovery leaves the combos mid-selection; reset before execute()
    // starts, same as the reset StrategyRunner does between tasks.
    const response = await page.goto(SEL.BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await assertNotBlocked(page, response);

    this.tasks = Object.freeze(uniqueTasks(tasks));
    return [...this.tasks];
  }

  /**
   * Identical flow to SingleSchoolStrategy — same combo navigation, one
   * task at a time. StrategyRunner loops them, resets the page between
   * schools, paces requests (humanDelay) and isolates/aborts on failure
   * or block.
   */
  async execute(page, task) {
    await scraper.selectYearAndCycle(page, {
      yearLabel: task.year,
      teachingType: task.teaching_cycle,
    });
    await scraper.selectDistrict(page, task.district);
    await scraper.selectCity(page, task.city);
    await scraper.selectSchool(page, task.school);
    await scraper.selectAllSubjects(page);
    await scraper.goToBooks(page);

    return scraper.extractBooks(page);
  }
}

module.exports = FullDistrictStrategy;