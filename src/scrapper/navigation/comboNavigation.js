'use strict';

const SEL = require('../selectors');
const { sleep } = require('../browser');

/**
 * Reads all options from a combobox-style dropdown (district/city/school/teachingType).
 * Opens the dropdown, reads the visible options, and closes it with Escape.
 */
async function getOptions(page, buttonSelector, listSelector) {
  await page.waitForSelector(buttonSelector, { state: 'visible', timeout: 12000 });
  await page.click(buttonSelector);
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });

  const options = await page.$$eval(SEL.optionInList(listSelector), elements =>
    elements.map(el => el.textContent.trim()).filter(Boolean)
  );

  await page.keyboard.press('Escape');
  await sleep(200);
  return options;
}

/** Opens a dropdown and clicks the option whose text matches `text`. */
async function pickOption(page, buttonSelector, listSelector, text) {
  await page.waitForSelector(buttonSelector, { state: 'visible', timeout: 12000 });
  await page.click(buttonSelector);
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });
  await page.locator(SEL.optionInList(listSelector), { hasText: text }).first().click();
  await sleep(400);
}

/**
 * Selects year + cycle/teaching type on the base page (already opened via
 * BrowserManager.openBasePage()).
 *
 * yearValue / yearLabel: both accepted as the year's data-value (e.g. "4"
 * for 4.º Ano). SEL.YEAR_BUTTON ('.anoEscolar') is legacy and no longer
 * exists on the page, so there is no separate text-based fallback anymore -
 * whichever of the two is passed is resolved through the same robust
 * data-value selector.
 * teachingType: cycle/teaching type text (e.g. "Ensino Básico (1º Ciclo)"), optional.
 */
async function selectYearAndCycle(page, { yearValue, yearLabel, teachingType } = {}) {
  const resolvedYear = yearValue || yearLabel;
  if (!resolvedYear) {
    throw new Error('selectYearAndCycle: yearValue or yearLabel is required.');
  }

  await page.waitForSelector(SEL.YEAR_BUTTON_DATA, { state: 'visible', timeout: 12000 });
  await page.locator(SEL.YEAR_BUTTON_DATA_VALUE(resolvedYear)).click();
  await sleep(400);

  if (teachingType) {
    const isVisible = await page.isVisible(SEL.TEACHING_TYPE_WRAPPER).catch(() => false);
    if (isVisible) {
      await pickOption(page, SEL.TEACHING_TYPE_COMBO, SEL.TEACHING_TYPE_LISTBOX, teachingType);
    }
  }

  await page.waitForSelector(SEL.DISTRICT_COMBO, { state: 'visible', timeout: 10000 });
}

/** Discovers the teaching types/cycles available for the currently selected year (if any). */
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

/** Discovers the schools available for the currently selected district/city. */
async function discoverSchools(page) {
  try {
    return await getOptions(page, SEL.SCHOOL_COMBO, SEL.SCHOOL_LISTBOX);
  } catch {
    return [];
  }
}

/** Selects a specific school by name in the school dropdown. */
async function selectSchool(page, schoolName) {
  await page.waitForSelector(SEL.SCHOOL_COMBO, { state: 'visible', timeout: 10000 });
  await page.click(SEL.SCHOOL_COMBO);
  await sleep(500);

  const option = page.locator(SEL.SCHOOL_OPTION, { hasText: schoolName });
  const count = await option.count();
  if (count === 0) {
    throw new Error(`selectSchool: school not found -> "${schoolName}"`);
  }
  await option.first().click();
  await sleep(400);
}

module.exports = {
  getOptions,
  pickOption,
  selectYearAndCycle,
  discoverTeachingTypes,
  selectDistrict,
  discoverDistricts,
  selectCity,
  discoverCities,
  discoverSchools,
  selectSchool,
};