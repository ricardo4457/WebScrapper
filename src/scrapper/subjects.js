'use strict';

const SEL = require('./selectors');

/**
 * Selects all available subjects for the current school.
 * 
 * Optimized to use a single page.evaluate() call to click all labels 
 * simultaneously, which is significantly faster than individual clicks.
 */
async function selectAllSubjects(page) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();

  const count = await page.evaluate(
    ({ containerSel, labelSel }) => {
      const containerEl = document.querySelector(containerSel);
      if (!containerEl) return 0;

      const labels = containerEl.querySelectorAll(labelSel);
      labels.forEach(label => label.click());
      return labels.length;
    },
    { containerSel: SEL.SUBJECTS_CONTAINER, labelSel: SEL.SUBJECTS_LABEL }
  );

  return count;
}

/**
 * Fallback: Selects subjects one by one with individual scrolling.
 * Use if batch clicking fails to trigger checkboxes correctly in specific layouts.
 */
async function selectAllSubjectsSequential(page) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();

  const labels = await container.locator(SEL.SUBJECTS_LABEL).elementHandles();
  for (const label of labels) {
    await label.scrollIntoViewIfNeeded();
    try {
      await label.click({ force: true });
    } catch {
      // Continue if an individual click fails
    }
  }
  return labels.length;
}

module.exports = {
  selectAllSubjects,
  selectAllSubjectsSequential,
};