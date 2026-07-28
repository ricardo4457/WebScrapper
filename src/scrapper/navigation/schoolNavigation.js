"use strict";
const comboNavigation = require("./comboNavigation");
const mapNavigation = require("./Mapnavigation");
const subjects = require("../subjects");
const books = require("../books");
const SEL = require("../selectors");
const { waitForLoadingToFinish } = require("../browser");
const { timed } = require("../../utils/RunTimings");

async function returnToSchoolSelection(page) {
  return timed(page, "navigation", async () => {
    const backButton = page.locator(SEL.BACK_TO_SEARCH_BUTTON);
    await backButton.click();
    await page.waitForSelector(SEL.SCHOOL_COMBO, {
      state: "visible",
      timeout: 10000,
    });
  });
}

async function scrapeSchool(page, { school }) {
  await timed(page, "navigation", async () => {
    await comboNavigation.selectSchool(page, school);
    await waitForLoadingToFinish(page);
  });

  return timed(page, "book_extraction", async () => {
    await subjects.selectAllSubjects(page);
    await books.goToBooks(page);
    return books.extractBooks(page);
  });
}

module.exports = {
  scrapeSchool,
  returnToSchoolSelection,
};
