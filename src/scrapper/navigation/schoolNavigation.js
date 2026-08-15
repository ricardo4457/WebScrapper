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

    // Some schools require a course to be selected before subjects are shown.
    const hasCourseStep = await page
      .isVisible(SEL.COURSE_WRAPPER)
      .catch(() => false);

    if (hasCourseStep) {
      const course = task.course;

      // Select the requested course or the page's default course.
      courseValues = course
        ? await comboNavigation.selectCourse(page, course)
        : await comboNavigation.selectDefaultCourse(page);

      await waitForLoadingToFinish(page);
    }
  });

  return timed(page, "book_extraction", async () => {
    await subjects.selectAllSubjects(page, courseValues);
    await books.goToBooks(page);
    await waitForLoadingToFinish(page);
    return books.extractBooks(page);
  });
}

module.exports = {
  scrapeSchool,
  returnToSchoolSelection,
};
