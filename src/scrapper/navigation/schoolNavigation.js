"use strict";
const comboNavigation = require("./comboNavigation");
const mapNavigation = require("./Mapnavigation");
const subjects = require("../subjects");
const books = require("../books");


async function returnToSchoolSelection(page) {
  const backButton = page.locator(SEL.BACK_TO_SEARCH_BUTTON);
  await backButton.click();
  await page.waitForSelector(SEL.SCHOOL_COMBO, {
    state: "visible",
    timeout: 10000,
  });
}

async function scrapeSchool(page, { school }) {
  await comboNavigation.selectSchool(page, school);
  await subjects.selectAllSubjects(page);
  await books.goToBooks(page);
  return books.extractBooks(page);
}

module.exports = {
  scrapeSchool,
  returnToSchoolSelection,
};
