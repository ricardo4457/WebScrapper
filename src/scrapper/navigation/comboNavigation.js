"use strict";

const SEL = require("../selectors");
const { humanDelay } = require("../humanization");

/** Escapes special regex characters. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns all options from a dropdown.
 */
async function getOptions(page, buttonSelector, listSelector) {
  const button = page.locator(buttonSelector);
  const list = page.locator(listSelector);

  await button.click(); // auto-waits: visible, stable, actionable, enabled
  await page.waitForSelector(SEL.optionInList(listSelector), { timeout: 8000 });

  const rawOptions = await page
    .locator(SEL.optionInList(listSelector))
    .allTextContents();
  const options = rawOptions.map((t) => t.trim()).filter(Boolean);

  await page.keyboard.press("Escape");
  await list.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});

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
  const option = page.locator(SEL.optionInList(listSelector), {
    hasText: exactMatch,
  });

  const count = await option.count();
  if (count === 0) {
    await page.keyboard.press("Escape");
    throw new Error(
      `pickOption: option not found -> "${text}" (${buttonSelector})`,
    );
  }

  await option.first().click();

  // Most dropdowns close themselves after picking an option; confirm
  // that instead of assuming it, and only fall back to Escape if not.
  try {
    await list.waitFor({ state: "hidden", timeout: 5000 });
  } catch {
    await page.keyboard.press("Escape");
  }

  // Mimic human interaction with a random delay.
  await humanDelay(200, 600);
}

/**
 * Selects a school year.
 * Uses a regex to tolerate whitespace differences.
 */
async function selectYear(page, year) {
  if (!year) {
    throw new Error("selectYear: year is required.");
  }

  const trimmed = year.trim();
  const numericMatch = trimmed.match(/^(\d{1,2})/);

  let button = null;

  if (numericMatch) {
    /**
     * Prefer the exact data-value selector when the year starts with a number.
     *
     * This avoids clicking hidden duplicate year buttons that can coexist in
     * the DOM, because we explicitly choose the visible match instead of
     * relying on a text lookup that may resolve to the wrong instance.
     */
    const candidates = page.locator(
      SEL.YEAR_BUTTON_DATA_VALUE(numericMatch[1]),
    );
    const count = await candidates.count();

    for (let i = 0; i < count; i++) {
      const candidate = candidates.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        button = candidate;
        break;
      }
    }
  }

  if (!button) {
    /**
     * Fallback for labels that do not start with a numeric year value.
     *
     * Keeps the previous text-based behavior for any special labels that do
     * not map cleanly to a data-value selector.
     */
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped.replace(/\s+/g, "\\s*")}$`);
    button = page.getByText(pattern);
  }

  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
}
/**
 * Selects the year and teaching cycle.
 */
async function selectTeachingType(page, teachingType) {
  if (!teachingType) return;

  const isVisible = await page
    .isVisible(SEL.TEACHING_TYPE_WRAPPER)
    .catch(() => false);
  if (!isVisible) return;

  await pickOption(
    page,
    SEL.TEACHING_TYPE_COMBO,
    SEL.TEACHING_TYPE_LISTBOX,
    teachingType,
  );
}

// The "Curso" dropdown works differently from the other dropdowns and
// can be flaky about showing as "visible", so we track it via the
// aria-expanded attribute instead of relying on visibility.
//
// The page sometimes shows #dropdownCursos TWICE. We pick the one that
// already has a course selected (data-value-selected); if neither does
// yet, we pick whichever one is actually visible.
async function courseButton(page) {
  const withSelection = page.locator(
    `${SEL.COURSE_COMBO}[data-value-selected]`,
  );
  if ((await withSelection.count()) > 0) {
    return withSelection.first();
  }

  // Neither has a selection yet — don't just grab the first one blindly,
  // it could be the hidden duplicate. Use the visible one instead.
  const candidates = page.locator(SEL.COURSE_COMBO);
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return candidates.first();
}

// Gets the course options (<li>) that belong to the SAME dropdown as
// "button" — needed because the page can duplicate the whole dropdown,
// so we don't want options from the other, hidden copy.
function courseOptionsFor(button) {
  return button.locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' cursos ')][1]//li[@data-value]",
  );
}

// The default "Formação Geral" course id lives in this hidden input,
// inside the same #cursos block.
function courseDefaultFor(button) {
  return button.locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' cursos ')][1]//input[@id='cursoDefault']",
  );
}

async function expandCourseDropdown(page) {
  const button = await courseButton(page);

  const isExpanded = (await button.getAttribute("aria-expanded")) === "true";
  if (!isExpanded) {
    await button.click();
    await courseOptionsFor(button).first().waitFor({
      state: "attached",
      timeout: 8000,
    });
  }

  // Returned so callers reuse this exact instance instead of
  // re-resolving courseButton() and risking a different match.
  return button;
}

async function discoverCourses(page) {
  const isPresent = await page
    .locator(SEL.COURSE_WRAPPER)
    .first()
    .isVisible()
    .catch(() => false);
  if (!isPresent) return [];

  try {
    const button = await expandCourseDropdown(page);
    const rawOptions = await courseOptionsFor(button).allTextContents();
    return rawOptions.map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function selectCourse(page, course) {
  if (!course) return null;

  const isPresent = await page
    .locator(SEL.COURSE_WRAPPER)
    .first()
    .isVisible()
    .catch(() => false);
  if (!isPresent) return null;

  const button = await expandCourseDropdown(page);

  const exactMatch = new RegExp(`^\\s*${escapeRegExp(course)}\\s*$`);
  const option = courseOptionsFor(button).filter({ hasText: exactMatch });

  const count = await option.count();
  if (count === 0) {
    throw new Error(`selectCourse: option not found -> "${course}"`);
  }

  const target = option.first();
  const value = await target.getAttribute("data-value");

  const defaultInput = courseDefaultFor(button);
  const defaultValue =
    (await defaultInput.count()) > 0
      ? await defaultInput.first().getAttribute("data-value")
      : null;

  // Use evaluate() to click directly, avoiding Playwright scroll issues
  // with elements inside hidden duplicate blocks.
  await target.evaluate((el) => el.click());

  // Mimic human interaction with a random delay.
  await humanDelay(200, 600);

  return { value, defaultValue };
}

// Used when a course is required but not specified.
// A course must be selected before the subjects can be displayed.
async function selectDefaultCourse(page) {
  const isPresent = await page
    .locator(SEL.COURSE_WRAPPER)
    .first()
    .isVisible()
    .catch(() => false);
  if (!isPresent) return null;

  const button = await expandCourseDropdown(page);
  const options = courseOptionsFor(button);

  const count = await options.count();
  if (count === 0) return null;

  const defaultInput = courseDefaultFor(button);
  const defaultValue =
    (await defaultInput.count()) > 0
      ? await defaultInput.first().getAttribute("data-value")
      : null;

  let targetIndex = 0;
  if (defaultValue) {
    const values = await options.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-value")),
    );
    const idx = values.indexOf(defaultValue);
    if (idx !== -1) targetIndex = idx;
  }

  const target = options.nth(targetIndex);
  const value = await target.getAttribute("data-value");

  await target.evaluate((el) => el.click());

  // Mimic human interaction with a random delay.
  await humanDelay(200, 600);

  return { value, defaultValue };
}

/** Wrapper to select year, cycle/teaching type and course. */
async function selectYearAndCycle(
  page,
  { yearValue, yearLabel, teachingType } = {},
) {
  const resolvedYear = yearValue || yearLabel;

  await selectYear(page, resolvedYear);
  await selectTeachingType(page, teachingType);

  await page.waitForSelector(SEL.DISTRICT_COMBO, {
    state: "visible",
    timeout: 10000,
  });
}

/**
 * Returns the available teaching cycles.
 */
async function discoverTeachingTypes(page) {
  const isVisible = await page
    .isVisible(SEL.TEACHING_TYPE_WRAPPER)
    .catch(() => false);
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
  selectCourse,
  selectDefaultCourse,
  discoverCourses,
  selectDistrict,
  discoverDistricts,
  selectCity,
  discoverCities,
  discoverSchools,
  selectSchool,
};
