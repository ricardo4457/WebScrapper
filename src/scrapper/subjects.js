'use strict';
 
const SEL = require('./selectors');
const { sleep } = require('./browser');
 
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
 
module.exports = {
  selectAllSubjects,
};
 