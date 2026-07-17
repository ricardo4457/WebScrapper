"use strict";

const { chromium } = require('playwright');
const SEL = require('./selectors');

/** Simple delay helper used throughout scraper.js between UI interactions. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Tipos de recurso que bloqueamos por rota - acelera o carregamento sem
// tocar em nada de que a navegação/JS da página dependa (document, script,
// xhr/fetch, stylesheet continuam a passar).
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

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
   * options.blockResources (default true) bloqueia imagens/fontes/media
   * via routing para acelerar o load - desativa se precisares de ver a
   * página completa (ex: debug visual) ou se o mapa SVG depender de algum
   * destes tipos de recurso.
   */
  async launch(options = {}) {
    this.browser = await chromium.launch({
      headless: options.headless !== false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // usa /tmp em vez de /dev/shm - evita crashes com shm_size pequeno em Docker
        '--no-sandbox',            // necessário em muitos containers Docker (sem isto o Chromium falha a arrancar)
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
    } catch {
      // banner de cookies não apareceu (ex: já aceite antes) - continua normalmente
    }

    return page;
  }

  /**
   * Reutilizável entre tasks (ex: FullDistrictStrategy a percorrer várias
   * escolas do mesmo distrito): volta à página base sem fechar/relançar o
   * browser inteiro. Muito mais barato do que close()+launch() por escola.
   */
  async resetToBasePage(page) {
    await page.goto(SEL.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
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