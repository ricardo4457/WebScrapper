'use strict';


function requireObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`'${fieldName}' must be an object.`);
  }

  return value;
}


function requireNonEmptyArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`'${fieldName}' must contain at least one item.`);
  }

  return value;
}


function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`'${fieldName}' is required.`);
  }

  return value.trim();
}


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


function createSchoolSelection(value, fieldPrefix) {
  const source = requireObject(value, fieldPrefix);

  return Object.freeze({
    city: requireText(source.city, `${fieldPrefix}.city`),
    school: requireText(source.school, `${fieldPrefix}.school`),
  });
}

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

/**
 * Identifies which combo-navigation "location" a task belongs to (everything
 * before the school combo: year/cycle/district/city). Two tasks with the
 * same key can skip re-selecting year/cycle/district/city between them.
 */
function locationKey(task) {
  return JSON.stringify([
    task.year,
    task.teaching_cycle,
    task.district,
    task.city,
  ]);
}

/**
 * Groups tasks that share a location key next to each other, keeping each
 * group's first-seen relative order (Map preserves insertion order). Used
 * so the runner can skip re-navigating year/district/city for consecutive
 * tasks in the same city, even if a strategy didn't already emit them that
 * way.
 */
function sortTasksByLocation(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = locationKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  return [...groups.values()].flat();
}

/**
 * Splits tasks into `laneCount` lanes for concurrent execution. Tasks are
 * grouped by location first and whole groups are handed to lanes (largest
 * group first, always to the currently-smallest lane) so:
 *  - a city's schools are never split across two lanes, which would defeat
 *    the same-location nav-skip optimization within a lane;
 *  - lane sizes stay roughly balanced even when city sizes vary a lot.
 * Empty lanes are dropped (e.g. laneCount > number of distinct locations).
 */
function partitionTasksIntoLanes(tasks, laneCount) {
  const groups = new Map();
  for (const task of tasks) {
    const key = locationKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  const lanes = Array.from({ length: Math.max(1, laneCount) }, () => []);
  const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length);

  for (const group of sortedGroups) {
    const smallestLane = lanes.reduce((min, lane) => (lane.length < min.length ? lane : min));
    smallestLane.push(...group);
  }

  return lanes.filter(lane => lane.length > 0);
}

// Clean CommonJS export of helper functions
module.exports = {
  createScrapeTask,
  createSchoolSelection,
  createYearSelection,
  createTaskKey,
  uniqueTasks,
  locationKey,
  sortTasksByLocation,
  partitionTasksIntoLanes,
  requireObject,
  requireNonEmptyArray,
  requireText,
  optionalText
};