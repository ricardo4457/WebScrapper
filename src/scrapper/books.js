"use strict";

const SEL = require("./selectors");
const { humanDelay } = require("./humanization");

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

  // Mimic human interaction with a random delay.
  await humanDelay(300, 700);
  await continueButton.click();

  try {
    await page.waitForSelector(
      `${SEL.ADOPTED_BOOKS_CONTAINER}, ${SEL.NO_BOOK_TEXT}`,
      { state: "visible", timeout: 15000 },
    );
  } catch {
    throw new Error(
      'goToBooks: nem a lista de livros adotados nem a mensagem de "sem adoções" apareceram. ' +
        "ADOPTED_BOOKS_CONTAINER/NO_BOOK_TEXT podem precisar de revalidação.",
    );
  }
}

/**
 * Extracts the adopted books from the current page.
 *
 * Only serializable selectors are passed to page.evaluate().
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

  return page.evaluate((sel) => {
    const bookBlocks = document.querySelectorAll(sel.BOOK_BLOCK);
    const books = [];

    bookBlocks.forEach((block) => {
      const disciplineEl = block.querySelector(sel.BOOK_DISCIPLINE);
      const discipline = disciplineEl ? disciplineEl.textContent.trim() : null;

      const typeEl = block.querySelector(sel.BOOK_TYPE);
      const type = typeEl ? typeEl.textContent.trim() : null;

      const titleEl = block.querySelector(sel.BOOK_TITLE);
      const title = titleEl ? titleEl.textContent.trim() : null;

      const authorsEl = block.querySelector(sel.BOOK_AUTHORS);
      const authors = authorsEl
        ? authorsEl.textContent.split(",").map((a) => a.trim())
        : [];

      const publisherEl = block.querySelector(sel.BOOK_PUBLISHER);
      const publisher = publisherEl ? publisherEl.textContent.trim() : null;

      const coverEl = block.querySelector(sel.BOOK_COVER);
      const coverImage = coverEl ? coverEl.src : null;

      const priceEl = block.querySelector(sel.BOOK_PRICE);
      const price = priceEl
        ? parseFloat(priceEl.getAttribute("data-preco"))
        : null;

      const quantityInput = block.querySelector(sel.BOOK_QUANTITY_INPUT);
      const course = quantityInput
        ? parseInt(quantityInput.getAttribute("data-curso"), 10)
        : null;
      const level = quantityInput
        ? parseInt(quantityInput.getAttribute("data-nivel"), 10)
        : null;

      if (title) {
        books.push({
          discipline,
          type,
          title,
          authors,
          publisher,
          coverImage,
          price,
          course,
          level,
        });
      } else {
        const noBookEl = block.querySelector(sel.NO_BOOK_TEXT);
        if (noBookEl) {
          books.push({
            discipline,
            type: null,
            title: noBookEl.textContent.trim(),
            authors: [],
            publisher: null,
            coverImage: null,
            price: null,
            course,
            level,
          });
        }
      }
    });

    return books;
  }, bookSel);
}

module.exports = {
  goToBooks,
  extractBooks,
};
