'use strict';

/**
 * Trims all string values in the job data.
 */
function sanitizeJobData(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = typeof value === "string" ? value.trim() : value;
  }
  return sanitized;
}

module.exports = { sanitizeJobData };