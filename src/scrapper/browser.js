"use strict";

const { chromium } = require("playwright");
const SEL = require("./selectors");

/** Simple delay helper used throughout scraper.js between UI interactions. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const { chromium } = require('playwright');
const SEL = require('./selectors');

/** Simple delay helper used throughout scraper.js between UI interactions. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Manages a single Playwright browser + context for one scraping task.
 * One BrowserManager instance = one task (SingleSchoolStrategy task,
 * or one school within a FullDistrictStrategy run).
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  /**
   * Launches Chromium. headless defaults to true; pass { headless: false }
   * locally to watch the scraper run.
   */
  async launch(options = {}) {
    this.browser = await chromium.launch({
      headless: options.headless !== false,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 900 },
      locale: 'pt-PT',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    return this.browser;
  }

  /**
   * Opens the school-books page and dismisses the cookie banner if present.
   * Must be called after launch(). Returns the ready-to-use Page.
   */
  async openBasePage() {
    if (!this.context) {
      throw new Error('BrowserManager.openBasePage: chama launch() primeiro.');
    }

    const page = await this.context.newPage();
    await page.goto(SEL.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForSelector(SEL.ACCEPT_COOKIES, { timeout: 5000 });
      await page.click(SEL.ACCEPT_COOKIES);
      await sleep(300);
    } catch {
      // banner de cookies não apareceu (ex: já aceite antes) - continua normalmente
    }

    return page;
  }

  /** Closes context + browser. Safe to call even if launch() failed partway. */
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
