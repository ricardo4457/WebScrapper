"use strict";

const { chromium } = require("playwright");
const SEL = require("./selectors");
const { assertNotBlocked } = require("./blockDetection");

/**
 * Creates a delay between actions.
 */ function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resource types to block for faster loading; excludes navigation-critical
// resources like documents, scripts, and fetch/XHR requests.
const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);

/**
 * Manages the Playwright browser lifecycle.
 * Handles browser creation, contexts and page management.
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    // Stores all created contexts so they can be closed together.
    this.contexts = [];
  }
  /**
   * Launches a Chromium browser instance.
   * Headless mode is enabled by default.
   */
  async launch(options = {}) {
    this.browser = await chromium.launch({
      headless: options.headless !== false,
      args: [
        "--disable-blink-features=AutomationControlled",
        // Reduces memory issues when running inside Docker.

        "--disable-dev-shm-usage",
        // Required by most Docker environments.

        "--no-sandbox",
      ],
    });

    return this.browser;
  }

  /**
   * Waits until the loading modal disappears.
   */
  async waitForLoadingToFinish(page) {
    const loadingModal = page.locator(SEL.LOADING_MODAL);
    await loadingModal
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {}); // se nunca aparecer, não bloqueia o fluxo
  }

  /**
   * Creates a new browser context.
   * Each context has its own cookies and storage.
   */
  async newContext(options = {}) {
    if (!this.browser) {
      throw new Error("BrowserManager.newContext: Call launch() first.");
    }

    const context = await this.browser.newContext({
      viewport: { width: 1366, height: 900 },
      locale: "pt-PT",
      // Uses a common browser user agent.

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    // Uses a common browser user agent.
    if (options.blockResources !== false) {
      await context.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (BLOCKED_RESOURCE_TYPES.has(type)) {
          return route.abort();
        }
        return route.continue();
      });
    }
    // Keep track of created contexts for later cleanup.

    this.contexts.push(context);
    return context;
  }

  /**
   * Opens the website in a new page.
   */
  async openPageInContext(context) {
    const page = await context.newPage();
    const response = await page.goto(SEL.BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Verify that the request was not blocked.
    await assertNotBlocked(page, response);

    try {
      // Accept cookies if the banner is displayed.

      await page.waitForSelector(SEL.ACCEPT_COOKIES, { timeout: 5000 });
      await page.click(SEL.ACCEPT_COOKIES);
    } catch {
      // Cookie banner not found or already accepted.
    }

    return page;
  }

  /**
   * Creates a new context and opens the base page.
   */
  async openBasePage(options = {}) {
    const context = await this.newContext(options);
    return this.openPageInContext(context);
  }

  /**
   * Navigates back to the website homepage.
   * Reusing the same page is faster than creating a new one.
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
   * Closes all browser contexts and the browser instance.
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

module.exports = { BrowserManager, sleep };
