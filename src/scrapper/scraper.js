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

/**
 * Moves from the subjects page to the adopted books page.
 *
 * Some schools/disciplines legitimately have zero adopted books, in which
 * case ADOPTED_BOOKS_CONTAINER never renders and only NO_BOOK_TEXT shows up.
 * Waiting on ADOPTED_BOOKS_CONTAINER alone would time out and throw on every
 * one of those cases - so we race both and only throw if neither appears.
 */
async function goToBooks(page) {
  const continueButton = page.locator(SEL.CONTINUE_BUTTON);
  await continueButton.scrollIntoViewIfNeeded();
  await continueButton.click();

  try {
    await page.waitForSelector(
      `${SEL.ADOPTED_BOOKS_CONTAINER}, ${SEL.NO_BOOK_TEXT}`,
      { state: 'visible', timeout: 15000 }
    );
  } catch {
    throw new Error(
      'goToBooks: nem a lista de livros adotados nem a mensagem de "sem adoções" apareceram. ' +
      'ADOPTED_BOOKS_CONTAINER/NO_BOOK_TEXT podem precisar de revalidação.'
    );
  }
}

/**
 * Extracts the list of adopted books (or "no adoptions") from the current page.
 *
 * NOTE: page.evaluate() only accepts JSON-serializable arguments. SEL itself
 * is not safe to pass directly because it carries the optionInList function -
 * Playwright would throw trying to serialize it. Only a plain subset of the
 * BOOK_* selectors is passed through here.
 */
async function extractBooks(page) {
  const bookSel = {
    BOOK_BLOCK: SEL.BOOK_BLOCK,
    BOOK_DISCIPLINE: SEL.BOOK_DISCIPLINE,
    BOOK_TYPE: SEL.BOOK_TYPE,
    BOOK_TITLE: SEL.BOOK_TITLE,
    BOOK_AUTHORS: SEL.BOOK_AUTHORS,
    BOOK_PUBLISHER: SEL.BOOK_PUBLISHER,
    BOOK_COVER: SEL.BOOK_COVER,
    BOOK_PRICE: SEL.BOOK_PRICE,
    BOOK_QUANTITY_INPUT: SEL.BOOK_QUANTITY_INPUT,
    NO_BOOK_TEXT: SEL.NO_BOOK_TEXT,
  };

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
  }, bookSel);
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