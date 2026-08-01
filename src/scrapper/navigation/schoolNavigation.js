"use strict";
const comboNavigation = require("./comboNavigation");
const mapNavigation = require("./Mapnavigation");
const subjects = require("../subjects");
const books = require("../books");
const SEL = require("../selectors");
const { waitForLoadingToFinish } = require("../browser");
const { timed } = require("../../utils/RunTimings");

async function returnToSchoolSelection(page) {
  return timed(page, "navigation", async () => {
    const backButton = page.locator(SEL.BACK_TO_SEARCH_BUTTON);
    await backButton.click();
    await page.waitForSelector(SEL.SCHOOL_COMBO, {
      state: "visible",
      timeout: 10000,
    });
  });
}

async function scrapeSchool(page, task) {
  let courseValues = null;

  await timed(page, "navigation", async () => {
    await comboNavigation.selectSchool(page, task.school);
    await waitForLoadingToFinish(page);

    // Some schools show an extra "Curso" step before the subjects list.
    // The site's UI only seems to properly refresh the disciplinas/
    // continuar state after an actual click on an option, even if one is
    // already shown as selected by default, so we always click something
    // when the step is present.
    const hasCourseStep = await page
      .isVisible(SEL.COURSE_WRAPPER)
      .catch(() => false);

    if (hasCourseStep) {
      const course =
        task.course || (await comboNavigation.discoverCourses(page))[0];

      if (course) {
        courseValues = await comboNavigation.selectCourse(page, course);
        await waitForLoadingToFinish(page);
      }
    }
  });

  return timed(page, "book_extraction", async () => {
    await subjects.selectAllSubjects(page, courseValues);
    await books.goToBooks(page);
    return books.extractBooks(page);
  });
}

module.exports = {
  scrapeSchool,
  returnToSchoolSelection,
};