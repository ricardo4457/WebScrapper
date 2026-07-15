"use strict";

const ScrapeTask = require("../ScrapeTask");

class FullDistrictStrategy extends ScrapeTask {
  async execute(page, payload) {
    const { districtId, runId } = payload;

    try {
      // 1. Discover schools belonging to this district
      const schools = await this.discoverSchools(page, districtId);

      if (!schools || schools.length === 0) {
        return {
          status: "success",
          message: `No schools found for district ${districtId}.`,
          schools: []
        };
      }

      // 2. We return the discovered schools. 
      // The Laravel callback controller will receive this payload, 
      // save them in its database, and enqueue individual school jobs if needed.
      return {
        status: "success",
        message: `District ${districtId} processed successfully. Found ${schools.length} schools.`,
        districtId: districtId,
        schools: schools, // Sent back to Laravel dynamically
      };
    } catch (error) {
      console.error(
        `[FullDistrictStrategy] Error processing district ${districtId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Helper method to navigate and extract the list of schools from the Wook website
   */
  async discoverSchools(page, districtId) {
    const url = `https://www.wook.pt/escolas/distrito/${districtId}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const schools = await page.evaluate(() => {
      // Note: Verify and update this selector based on your selectors.js file
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