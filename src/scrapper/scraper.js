'use strict';

const SEL = require('./selectors');
const { sleep } = require('./browser');

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
 * yearValue: the year button's data-value attribute (preferred, more robust).
 * yearLabel: the year button's text, used as a fallback if yearValue is not passed.
 * teachingType: cycle/teaching type text (e.g. "Ensino Básico (1º Ciclo)"), optional.
 */
async function selectYearAndCycle(page, { yearValue, yearLabel, teachingType } = {}) {
  if (yearValue) {
    await page.locator(`${SEL.YEAR_BUTTON_DATA}[data-value="${yearValue}"]`).click();
  } else if (yearLabel) {
    await page.locator(SEL.YEAR_BUTTON, { hasText: yearLabel }).first().click();
  } else {
    throw new Error('selectYearAndCycle: yearValue or yearLabel is required.');
  }
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

/** Selects every available subject for the currently selected school. */
async function selectAllSubjects(page) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();
  await sleep(300);

  const labels = await container.locator(SEL.SUBJECTS_LABEL).elementHandles();
  for (const label of labels) {
    await label.scrollIntoViewIfNeeded();
    await sleep(80);
    try {
      await label.click({ force: true });
    } catch {
      // if one subject fails to click, continue with the rest
    }
  }
  return labels.length;
}

/** Moves from the subjects page to the adopted books page. */
async function goToBooks(page) {
  const continueButton = page.locator(SEL.CONTINUE_BUTTON);
  await continueButton.scrollIntoViewIfNeeded();
  await continueButton.click();
  await page.waitForSelector(SEL.ADOPTED_BOOKS_CONTAINER, { state: 'visible', timeout: 15000 });
}

/** Extracts the list of adopted books (or "no adoptions") from the current page. */
async function extractBooks(page) {
  return page.evaluate(sel => {
    const bookBlocks = document.querySelectorAll(sel.BOOK_BLOCK);
    const books = [];

    bookBlocks.forEach(block => {
      const disciplineEl = block.querySelector(sel.BOOK_DISCIPLINE);
      const discipline = disciplineEl ? disciplineEl.textContent.trim() : null;

      const typeEl = block.querySelector(sel.BOOK_TYPE);
      const type = typeEl ? typeEl.textContent.trim() : null;

      const titleEl = block.querySelector(sel.BOOK_TITLE);
      const title = titleEl ? titleEl.textContent.trim() : null;

      const authorsEl = block.querySelector(sel.BOOK_AUTHORS);
      const authors = authorsEl ? authorsEl.textContent.split(',').map(a => a.trim()) : [];

      const publisherEl = block.querySelector(sel.BOOK_PUBLISHER);
      const publisher = publisherEl ? publisherEl.textContent.trim() : null;

      const coverEl = block.querySelector(sel.BOOK_COVER);
      const coverImage = coverEl ? coverEl.src : null;

      const priceEl = block.querySelector(sel.BOOK_PRICE);
      const price = priceEl ? parseFloat(priceEl.getAttribute('data-preco')) : null;

      const quantityInput = block.querySelector(sel.BOOK_QUANTITY_INPUT);
      const course = quantityInput ? parseInt(quantityInput.getAttribute('data-curso'), 10) : null;
      const level = quantityInput ? parseInt(quantityInput.getAttribute('data-nivel'), 10) : null;

      if (title) {
        books.push({
          discipline, type, title, authors, publisher,
          coverImage, price, course, level,
        });
      } else {
        const noBookEl = block.querySelector(sel.NO_BOOK_TEXT);
        if (noBookEl) {
          books.push({
            discipline, type: null, title: noBookEl.textContent.trim(),
            authors: [], publisher: null, coverImage: null, price: null,
            course, level,
          });
        }
      }
    });

    return books;
  }, SEL);
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
  selectAllSubjects,
  goToBooks,
  extractBooks,
};