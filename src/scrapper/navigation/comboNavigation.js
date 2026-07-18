'use strict';

const SEL = require('../selectors');

/** Escapes special regex characters. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns all options from a dropdown.
 */
async function getOptions(page, buttonSelector, listSelector) {
  const button = page.locator(buttonSelector);
  const list = page.locator(listSelector);

  await button.click(); // auto-waits: visible, stable, actionable, enabled
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });

  const rawOptions = await page.locator(SEL.optionInList(listSelector)).allTextContents();
  const options = rawOptions.map(t => t.trim()).filter(Boolean);

  await page.keyboard.press('Escape');
  await list.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

  return options;
}

/**
 * Selects an option by exact text.
 */
async function pickOption(page, buttonSelector, listSelector, text) {
  const button = page.locator(buttonSelector);
  const list = page.locator(listSelector);

  await button.click();
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });

  const exactMatch = new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);
  const option = page.locator(SEL.optionInList(listSelector), { hasText: exactMatch });

  const count = await option.count();
  if (count === 0) {
    await page.keyboard.press('Escape');
    throw new Error(`pickOption: option not found -> "${text}" (${buttonSelector})`);
  }

  await option.first().click();

  // Most dropdowns close themselves after picking an option; confirm
  // that instead of assuming it, and only fall back to Escape if not.
  try {
    await list.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    await page.keyboard.press('Escape');
  }
}

/**
 * Selects a school year.
 * Uses a regex to tolerate whitespace differences.
 */
async function selectYear(page, year) {
  if (!year) {
    throw new Error('selectYear: year is required.');
  }

  const escaped = year.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped.replace(/\s+/g, '\\s*')}$`);

  await page.getByText(pattern).click();
}
/**
 * Selects the year and teaching cycle.
 */
async function selectTeachingType(page, teachingType) {
  if (!teachingType) return;

  const isVisible = await page.isVisible(SEL.TEACHING_TYPE_WRAPPER).catch(() => false);
  if (!isVisible) return;

  await pickOption(page, SEL.TEACHING_TYPE_COMBO, SEL.TEACHING_TYPE_LISTBOX, teachingType);
}

/** Wrapper to select both year and cycle/teaching type. */
async function selectYearAndCycle(page, { yearValue, yearLabel, teachingType } = {}) {
  const resolvedYear = yearValue || yearLabel;

  await selectYear(page, resolvedYear);
  await selectTeachingType(page, teachingType);

  await page.waitForSelector(SEL.DISTRICT_COMBO, { state: 'visible', timeout: 10000 });
}

/**
 * Returns the available teaching cycles.
 */
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

/**
 * Selects the teaching cycle if available.
 */
async function selectCity(page, city) {
  await pickOption(page, SEL.CITY_COMBO, SEL.CITY_LISTBOX, city);
}

async function discoverCities(page) {
  return getOptions(page, SEL.CITY_COMBO, SEL.CITY_LISTBOX);
}

/**
 * Discovers schools available for the currently selected district/city.
 * SCHOOL_COMBO/SCHOOL_LISTBOX are also [UNVERIFIED] — same caveat as city.
 */
async function discoverSchools(page) {
  try {
    return await getOptions(page, SEL.SCHOOL_COMBO, SEL.SCHOOL_LISTBOX);
  } catch {
    return [];
  }
}

/** Selects a school by name. Reuses pickOption for the same exact-match/error behavior as every other combo. */
async function selectSchool(page, schoolName) {
  await pickOption(page, SEL.SCHOOL_COMBO, SEL.SCHOOL_LISTBOX, schoolName);
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