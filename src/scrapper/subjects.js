"use strict";

const SEL = require("./selectors");
const { humanDelay } = require("./humanization");

/**
 * Select all available subjects.
 */
async function selectAllSubjects(page) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();

  const labels = await container.locator(SEL.SUBJECTS_LABEL).all();

  for (const label of labels) {
    await label.scrollIntoViewIfNeeded();
    await label.click();
    // Mimic human interaction with a random delay.
    await humanDelay(150, 400);
  }

  return labels.length;
}

/**
 * Fallback that skips failed subject clicks.
 */
async function selectAllSubjectsSequential(page) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();

  const labels = await container.locator(SEL.SUBJECTS_LABEL).all();
  let selected = 0;

  for (const label of labels) {
    await label.scrollIntoViewIfNeeded();
    try {
      await label.click({ force: true });
      selected++;
      await humanDelay(150, 400);
    } catch (err) {
      console.warn(`Failed to click a subject: ${err.message}`);
    }
  }

  return selected;
}

module.exports = {
  selectAllSubjects,
  selectAllSubjectsSequential,
};
