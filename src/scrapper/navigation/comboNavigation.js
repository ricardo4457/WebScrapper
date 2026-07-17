'use strict';

const SEL = require('../selectors');
const { sleep } = require('../browser');

/** Reads all options from a dropdown and closes it. */
async function getOptions(page, buttonSelector, listSelector) {
  await page.waitForSelector(buttonSelector, { state: 'visible', timeout: 12000 });
  await page.click(buttonSelector);
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });

  const options = await page.$$eval(SEL.optionInList(listSelector), elements =>
    elements.map(el => el.textContent.trim()).filter(Boolean)
  );

  await page.keyboard.press('Escape');
  return options;
}

/** Opens a dropdown and selects the option matching the provided text. */
async function pickOption(page, buttonSelector, listSelector, text) {
  await page.waitForSelector(buttonSelector, { state: 'visible', timeout: 12000 });
  await page.click(buttonSelector);
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });
  await page.locator(SEL.optionInList(listSelector), { hasText: text }).first().click();
}

/** Selects the year button; does not touch teaching type. */
async function selectYear(page, year) {
  if (!year) {
    throw new Error('selectYear: year is required.');
  }

  await page.waitForSelector(SEL.YEAR_BUTTON_DATA, { state: 'visible', timeout: 12000 });
  await page.locator(SEL.YEAR_BUTTON_DATA_VALUE(year)).click();
}

/** Selects the teaching type/cycle if the wrapper is visible. */
async function selectTeachingType(page, teachingType) {
  if (!teachingType) return;

  const isVisible = await page.isVisible(SEL.TEACHING_TYPE_WRAPPER).catch(() => false);
  if (!isVisible) return;

  await pickOption(page, SEL.TEACHING_TYPE_COMBO, SEL.TEACHING_TYPE_LISTBOX, teachingType);
}

/** Helper to select both year and cycle. */
async function selectYearAndCycle(page, { yearValue, yearLabel, teachingType } = {}) {
  const resolvedYear = yearValue || yearLabel;

  await selectYear(page, resolvedYear);
  await selectTeachingType(page, teachingType);

  await page.waitForSelector(SEL.DISTRICT_COMBO, { state: 'visible', timeout: 10000 });
}

/** Discovers available teaching types for the current year. */
async function discoverTeachingTypes(page) {
  const isVisible = await page.isVisible(SEL.TEACHING_TYPE_WRAPPER).catch(() => false);
  if (!isVisible) return [];
  return getOptions(page, SEL.TEACHING_TYPE_COMBO, SEL.TEACHING_TYPE_LISTBOX);
}

async function selectDistrict(page, district) {
  await pickOption(page, SEL.DISTRICT_COMBO, SEL.DISTRICT_LISTBOX, district);
}

async function discoverDistricts(page) {
  return getOptions(page, SEL.DISTRICT_COMBO, SEL.DISTRICT_LISTBOX);
}

async function selectCity(page, city) {
  await pickOption(page, SEL.CITY_COMBO, SEL.CITY_LISTBOX, city);
}

async function discoverCities(page) {
  return getOptions(page, SEL.CITY_COMBO, SEL.CITY_LISTBOX);
}

/** Discovers available schools for the current district/city. */
async function discoverSchools(page) {
  try {
    return await getOptions(page, SEL.SCHOOL_COMBO, SEL.SCHOOL_LISTBOX);
  } catch {
    return [];
  }
}

/** Selects a school by name. */
async function selectSchool(page, schoolName) {
  await page.waitForSelector(SEL.SCHOOL_COMBO, { state: 'visible', timeout: 10000 });
  await page.click(SEL.SCHOOL_COMBO);
  await page.waitForSelector(SEL.SCHOOL_OPTION, { state: 'visible', timeout: 8000 });

  const option = page.locator(SEL.SCHOOL_OPTION, { hasText: schoolName });
  const count = await option.count();
  if (count === 0) {
    throw new Error(`selectSchool: school not found -> "${schoolName}"`);
  }
  await option.first().click();
}

module.exports = {
  getOptions,
  pickOption,
  selectYear,
  selectTeachingType,
  selectYearAndCycle,
  discoverTeachingTypes,
  selectDistrict,
  discoverDistricts,
  selectCity,
  discoverCities,
  discoverSchools,
  selectSchool,
};