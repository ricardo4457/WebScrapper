'use strict';

/**
 * Merges module exports and rejects duplicate keys.
 */
function mergeExclusive(modules) {
  const seenIn = {};
  const merged = {};

  for (const [moduleName, exportsObj] of Object.entries(modules)) {
    for (const [key, value] of Object.entries(exportsObj)) {
      if (seenIn[key]) {
        throw new Error(
          `mergeExclusive: "${key}" está exportado tanto em "${seenIn[key]}" ` +
          `como em "${moduleName}" - remove a duplicação antes de continuar.`
        );
      }
      seenIn[key] = moduleName;
      merged[key] = value;
    }
  }

  return merged;
}

module.exports = { mergeExclusive };