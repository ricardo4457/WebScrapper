'use strict';

/**
 * Canonical task format shared by every strategy and the Worker.
 *
 * @typedef {Object} ScrapeTask
 * @property {string} year School year to select in Wook.
 * @property {string|null} teaching_cycle Teaching cycle, when applicable.
 * @property {string} district School district.
 * @property {string} city School municipality.
 * @property {string} school Exact school name shown by Wook.
 */

/**
 * @typedef {Object} SchoolSelection
 * @property {string} city School municipality.
 * @property {string} school Exact school name shown by Wook.
 */

/**
 * @typedef {Object} YearSelection
 * @property {string} year School year to select in Wook.
 * @property {string|null} teaching_cycle Teaching cycle, when applicable.
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {object}
 */
function requireObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`'${fieldName}' must be an object.`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {unknown[]}
 */
function requireNonEmptyArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`'${fieldName}' must contain at least one item.`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`'${fieldName}' is required.`);
  }

  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string|null}
 */
function optionalText(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireText(value, fieldName);
}

/**
 * Validates and creates one complete Worker task.
 *
 * Strategies only use the canonical Node field names. Input translation belongs
 * at the HTTP boundary, before a strategy is selected.
 *
 * @param {unknown} value
 * @param {string} [fieldPrefix]
 * @returns {ScrapeTask}
 */
function createScrapeTask(value, fieldPrefix = '') {
  const source = requireObject(value, fieldPrefix || 'task');
  const prefix = fieldPrefix ? `${fieldPrefix}.` : '';

  return Object.freeze({
    year: requireText(source.year, `${prefix}year`),
    teaching_cycle: optionalText(source.teaching_cycle, `${prefix}teaching_cycle`),
    district: requireText(source.district, `${prefix}district`),
    city: requireText(source.city, `${prefix}city`),
    school: requireText(source.school, `${prefix}school`),
  });
}

/**
 * @param {unknown} value
 * @param {string} fieldPrefix
 * @returns {SchoolSelection}
 */
function createSchoolSelection(value, fieldPrefix) {
  const source = requireObject(value, fieldPrefix);

  return Object.freeze({
    city: requireText(source.city, `${fieldPrefix}.city`),
    school: requireText(source.school, `${fieldPrefix}.school`),
  });
}

/**
 * @param {unknown} value
 * @param {string} fieldPrefix
 * @returns {YearSelection}
 */
function createYearSelection(value, fieldPrefix) {
  const source = requireObject(value, fieldPrefix);

  return Object.freeze({
    year: requireText(source.year, `${fieldPrefix}.year`),
    teaching_cycle: optionalText(source.teaching_cycle, `${fieldPrefix}.teaching_cycle`),
  });
}

/**
 * Returns a stable identifier for one task without relying on object property
 * order. It is only used to prevent duplicate queue jobs.
 *
 * @param {ScrapeTask} task
 * @returns {string}
 */
function createTaskKey(task) {
  return JSON.stringify([
    task.year,
    task.teaching_cycle,
    task.district,
    task.city,
    task.school,
  ]);
}

/**
 * @param {ScrapeTask[]} tasks
 * @returns {ScrapeTask[]}
 */
function uniqueTasks(tasks) {
  const keys = new Set();

  return tasks.filter(task => {
    const key = createTaskKey(task);
    if (keys.has(key)) {
      return false;
    }

    keys.add(key);
    return true;
  });
}

module.exports = {
  createSchoolSelection,
  createScrapeTask,
  createYearSelection,
  optionalText,
  requireNonEmptyArray,
  requireObject,
  requireText,
  uniqueTasks,
};
