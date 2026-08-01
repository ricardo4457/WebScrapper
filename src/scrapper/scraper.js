"use strict";

const comboNavigation = require("./navigation/comboNavigation");
const schoolNavigation = require("./navigation/schoolNavigation");
const mapNavigation = require("./navigation/Mapnavigation");
const subjects = require("./subjects");
const books = require("./books");
const { mergeExclusive } = require("../utils/MergeExclusive");
const { waitForLoadingToFinish } = require("../scrapper/browser");

const modules = {
  comboNavigation,
  mapNavigation,
  subjects,
  books,
  schoolNavigation,
};

mergeExclusive(modules);

/**
 * Selects the year, cycle, district and city.
 * Reused for schools in the same city to avoid repeating the same steps.
 */
async function navigateToLocation(
  page,
  { year, teaching_cycle, course, district, city },
) {
  await comboNavigation.selectYearAndCycle(page, {
    yearLabel: year,
    teachingType: teaching_cycle,
    course : course,
  });
  await comboNavigation.selectDistrict(page, district);
  await comboNavigation.selectCity(page, city);
}

module.exports = {
  ...comboNavigation,
  ...mapNavigation,
  ...subjects,
  ...books,
  ...schoolNavigation,
  navigateToLocation,
  waitForLoadingToFinish,
};
