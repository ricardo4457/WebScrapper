"use strict";

const SEL = require("./selectors");
const { assertNotBlocked } = require("./blockDetection");

/**
 * Creates a controlled delay between asynchronous operations.
 * Useful for simulating natural interaction timing and avoiding excessive requests.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for the website loading indicator to disappear before continuing execution.
 * If the indicator does not appear, the flow continues without interruption.
 */
async function waitForLoadingToFinish(page) {
  const loadingModal = page.locator(SEL.LOADING_MODAL);
  await loadingModal
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(() => {});
}

/**
 * Defines resource types that are not required for scraping.
 * Blocking these resources reduces page load time and network usage while keeping
 * the required application resources available.
 */
const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);

/**
 * Manages the browser lifecycle used by the scraper.
 *
 * Responsible for:
 * - Starting the selected browser engine.
 * - Creating isolated browser contexts.
 * - Managing opened pages.
 * - Cleaning resources after execution.
 *
 * Supports multiple engines configured through SCRAPER_ENGINE:
 * - chromium: Uses Chrome through Patchright.
 * - camoufox: Uses a modified Firefox binary through camoufox-js.
 */
class BrowserManager {
  constructor() {
    this.browser = null;

    // Keeps references to created contexts to guarantee proper cleanup.
    this.contexts = [];

    this.engine = null;
  }

  /**
   * Starts the browser instance using the configured engine.
   * Headless execution is enabled by default unless explicitly disabled.
   */
  async launch(options = {}) {
    const headless =
      options.headless !== undefined
        ? options.headless
        : process.env.SCRAPER_HEADLESS !== "false";

    this.engine = options.engine || process.env.SCRAPER_ENGINE || "chromium";

    if (this.engine === "camoufox") {
      const { Camoufox } = require("camoufox-js");

      this.browser = await Camoufox({
        headless,
        humanize: true,
        geoip: true,
      });

      console.log(
        `[BrowserManager] Camoufox (Firefox) lançado (headless: ${headless}).`,
      );
    } else {
      const { chromium } = require("patchright");

      this.browser = await chromium.launch({
        headless,
        channel: "chrome",
        // Patchright applies the required browser modifications internally.
      });

      console.log(
        `[BrowserManager] Chrome lançado via Patchright (headless: ${headless}).`,
      );
    }

    return this.browser;
  }

  /**
   * Creates an isolated browser context.
   *
   * Each context maintains independent cookies, storage and session data,
   * allowing multiple scraping executions without sharing state.
   */
  async newContext(options = {}) {
    if (!this.browser) {
      throw new Error("BrowserManager.newContext: Call launch() first.");
    }

    const context = await this.browser.newContext({
      viewport: null,
      locale: "pt-PT",
    });

    // Reduces unnecessary network requests by blocking non-essential assets.
    if (options.blockResources !== false) {
      await context.route("**/*", (route) => {
        const type = route.request().resourceType();

        if (BLOCKED_RESOURCE_TYPES.has(type)) {
          return route.abort();
        }

        return route.continue();
      });
    }

    this.contexts.push(context);

    return context;
  }

  /**
   * Opens a new page inside an existing browser context.
   *
   * Performs initial navigation, verifies possible blocking mechanisms,
   * and handles cookie consent when required.
   */
  async openPageInContext(context) {
    const page = await context.newPage();

    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Ensures the scraper does not continue after anti-bot blocking.
    await assertNotBlocked(page, response);

    try {
      // Accepts the cookie banner when it is displayed on first access.
      await page.waitForSelector(SEL.ACCEPT_COOKIES, { timeout: 5000 });
      await page.click(SEL.ACCEPT_COOKIES);
    } catch {
      // Cookie banner may not exist or could already be accepted.
    }

    return page;
  }

  /**
   * Creates a new browsing context and loads the initial website page.
   */
  async openBasePage(options = {}) {
    const context = await this.newContext(options);

    return this.openPageInContext(context);
  }

  /**
   * Returns an existing page to the initial website state.
   *
   * Reusing the same page avoids unnecessary browser initialization overhead
   * and improves scraping performance.
   */
  async resetToBasePage(page) {
    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await assertNotBlocked(page, response);

    return page;
  }

  /**
   * Releases all browser resources.
   *
   * Closes contexts first and then terminates the browser instance,
   * preventing memory leaks during long scraping executions.
   */
  async close() {
    for (const context of this.contexts) {
      await context.close().catch(() => {});
    }

    this.contexts = [];

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

module.exports = {
  BrowserManager,
  sleep,
  waitForLoadingToFinish,
};
