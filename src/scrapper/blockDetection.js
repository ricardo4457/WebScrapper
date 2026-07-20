'use strict';

/**
 * Detects anti-bot blocks and challenges.
 */

/**
 * Error thrown when a block or challenge is detected.
 */
class BlockDetectedError extends Error {
  constructor(reason) {
    super(`Blocked by target site: ${reason}`);
    this.name = 'BlockDetectedError';
    this.reason = reason;
  }
}

// HTTP status codes commonly used for blocking.
const BLOCK_STATUS_CODES = new Set([403, 429, 503]);

// Common text found on block and challenge pages.
const BLOCK_TEXT_SIGNALS = [
  'checking your browser',
  'attention required! | cloudflare',
  'sorry, you have been blocked',
  'access denied',
  'verifying you are human',
  'unusual traffic',
];

/**
 * Checks the page content for block indicators.
 */
function assertResponseNotBlocked(response) {
  if (!response) return;

  const status = response.status();
  if (BLOCK_STATUS_CODES.has(status)) {
    throw new BlockDetectedError(`HTTP ${status}`);
  }
}

/**
 * Checks the page content for block indicators.
 * Ignores read errors.
 */
async function assertContentNotBlocked(page) {
  const title = (await page.title().catch(() => '')) || '';
  const bodyText = (await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')) || '';
  const haystack = `${title}\n${bodyText}`.toLowerCase();

  const matched = BLOCK_TEXT_SIGNALS.find(signal => haystack.includes(signal));
  if (matched) {
    throw new BlockDetectedError(matched);
  }
}

/**
 * Checks whether the current page is blocked.
 */
async function assertNotBlocked(page, response) {
  assertResponseNotBlocked(response);
  await assertContentNotBlocked(page);
}

module.exports = { BlockDetectedError, assertNotBlocked };
