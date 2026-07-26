"use strict";

/**
 * Creates a browser context for a lane and ensures it is
 * always closed after the provided work completes.
 *
 */
async function withLaneContext(browserManager, work) {
  const context = await browserManager.newContext();

  try {
    return await work(context);
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = { withLaneContext };