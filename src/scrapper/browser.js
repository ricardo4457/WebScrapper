"use strict";

const { chromium } = require('playwright');
const SEL = require('./selectors');

/** Simple delay helper used throughout scraper.js between UI interactions. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Resource types to block for faster loading; excludes navigation-critical 
// resources like documents, scripts, and fetch/XHR requests.
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

/**
 * Manages a Playwright browser instance and context for scraping tasks.
 * One BrowserManager instance = one task (SingleSchoolStrategy or a 
 * single school within a FullDistrictStrategy run).
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  /**
   * Launches Chromium. Pass { headless: false } for visual debugging.
   * Options:
   * - blockResources (default true): Blocks images/fonts/media to speed up load times.
   */
  async launch(options = {}) {
    this.browser = await chromium.launch({
      headless: options.headless !== false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (avoids Docker memory crashes)
        '--no-sandbox',            // Required for most Docker containers
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 900 },
      locale: 'pt-PT',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    if (options.blockResources !== false) {
      await this.context.route('**/*', route => {
        const type = route.request().resourceType();
        if (BLOCKED_RESOURCE_TYPES.has(type)) {
          return route.abort();
        }
        return route.continue();
      });
    }

    return this.browser;
  }

  /**
   * Opens the base URL and dismisses the cookie banner if present.
   * Must be called after launch(). Returns the ready-to-use Page.
   */
  async openBasePage() {
    if (!this.context) {
      throw new Error('BrowserManager.openBasePage: Call launch() first.');
    }

    const page = await this.context.newPage();
    await page.goto(SEL.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForSelector(SEL.ACCEPT_COOKIES, { timeout: 5000 });
      await page.click(SEL.ACCEPT_COOKIES);
    } catch {
      // Cookie banner not found or already accepted
    }

    return page;
  }

  /**
   * Navigates back to the base page to reuse the existing session.
   * Significantly faster than re-launching the browser for each school.
   */
  async resetToBasePage(page) {
    await page.goto(SEL.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return page;
  }

  /** Closes context and browser instances safely. */
  async close() {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

module.exports = { BrowserManager, sleep };