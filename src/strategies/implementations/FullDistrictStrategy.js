"use strict";

const ScrapeTask = require("../ScrapeTask");
const SchoolRepository = require("../../repository/SchoolRepository");
const ScrapeQueue = require("../../queue/ScrapeQueue");

class FullDistrictStrategy extends ScrapeTask {
  async execute(page, payload) {
    const { districtId, runId } = payload;
    //console.log(
      `[FullDistrictStrategy] Starting scraping for district: ${districtId}`,
    );

    try {
      // 1. Discover schools belonging to this district
      const schools = await this.discoverSchools(page, districtId);
      //console.log(
        `[FullDistrictStrategy] Found ${schools.length} schools for district ${districtId}`,
      );

      if (!schools || schools.length === 0) {
        return {
          status: "success",
          message: `No schools found for district ${districtId}.`,
        };
      }

      // 2. Process each discovered school
      for (const school of schools) {
        // Save or update the school in the database
        const savedSchool = await SchoolRepository.upsert({
          name: school.name,
          wookId: school.id,
          districtId: districtId,
        });

        // 3. ENQUEUE A NEW INDIVIDUAL JOB IN THE BULL QUEUE
        // This distributes the load asynchronously and avoids timeouts!
        await ScrapeQueue.add({
          strategy: "SINGLE_SCHOOL", // Strategy identifier in your StrategyFactory
          runId: runId,
          schoolId: savedSchool.id,
          wookSchoolId: school.id,
        });
      }

      return {
        status: "success",
        message: `District ${districtId} processed successfully. ${schools.length} schools were sent to the queue.`,
      };
    } catch (error) {
      console.error(
        `[FullDistrictStrategy] Error processing district ${districtId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper method to navigate and extract the list of schools from the Wook website
   */
  async discoverSchools(page, districtId) {
    // Example navigation flow (adjust URL and selectors based on your selectors.js)
    const url = `https://www.wook.pt/escolas/distrito/${districtId}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Example extraction based on Wook's typical structure
    const schools = await page.evaluate(() => {
      // This selector should be validated with your selectors.js file
      const elements = document.querySelectorAll(".school-link-selector");
      return Array.from(elements).map((el) => ({
        id: el.getAttribute("data-id") || el.href.split("/").pop(),
        name: el.innerText.trim(),
      }));
    });

    return schools;
  }
}

module.exports = FullDistrictStrategy;
