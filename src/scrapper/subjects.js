"use strict";

const SEL = require("./selectors");
const { humanDelay } = require("./humanization");

// If no course was picked, select every checkbox .
// If a course WAS picked, only select checkboxes for that course +
// the "Formação Geral" ones (those apply to every course).
function subjectLabelSelector(courseValues) {
  if (!courseValues || !courseValues.value) {
    return SEL.SUBJECTS_LABEL;
  }

  const cursoIds = new Set([courseValues.value]);
  if (courseValues.defaultValue) {
    cursoIds.add(courseValues.defaultValue);
  }

  const attrMatches = [...cursoIds]
    .map((id) => `input[data-curso="${id}"]`)
    .join(", ");

  return `${SEL.SUBJECTS_LABEL}:has(${attrMatches})`;
}

/**
 * Clicks every subject checkbox. Pass in courseValues (from selectCourse)
 * to only click that course's subjects instead of all of them.
 */
async function selectAllSubjects(page, courseValues) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  const labels = await container
    .locator(subjectLabelSelector(courseValues))
    .all();

  for (const label of labels) {
    await label.scrollIntoViewIfNeeded();
    await label.click();
    // Mimic human interaction with a random delay.
    await humanDelay(150, 400);
  }

  return labels.length;
}

/**
 * Same as selectAllSubjects, but skips a checkbox instead of crashing
 * if a click fails.
 */
async function selectAllSubjectsSequential(page, courseValues) {
  const container = page.locator(SEL.SUBJECTS_CONTAINER);
  await container.scrollIntoViewIfNeeded();

  const labels = await container
    .locator(subjectLabelSelector(courseValues))
    .all();
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