"use strict";

const fs = require("fs");
const path = require("path");

// Where snapshots get written. Override with SCRAPER_DEBUG_DIR if the
// container's working dir isn't where you want to look for them.
const DEBUG_DIR = process.env.SCRAPER_DEBUG_DIR || "debug";

// Set SCRAPER_DEBUG=true to enable debugLog() output. Off by default so
// call sites can log freely without spamming production output.
const DEBUG_ENABLED = process.env.SCRAPER_DEBUG === "true";

/**
 * Centralized debug logger. No-op unless SCRAPER_DEBUG=true, so call sites
 * (strategies, browser lifecycle, etc.) can log diagnostic detail without
 * needing their own console.warn/console.error + env checks.
 *
 * @param {string} scope short tag identifying the caller, e.g. "browser"
 * @param {string} message
 * @param {unknown} [detail] optional extra value (error, object) to log
 */
function debugLog(scope, message, detail) {
  if (!DEBUG_ENABLED) return;
  const tag = `[debug:${scope}]`;
  if (detail !== undefined) {
    console.warn(tag, message, detail);
  } else {
    console.warn(tag, message);
  }
}

function safeSlug(label) {
  return String(label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

/**
 * Captures a full-page screenshot, the full HTML, and the outerHTML/class
 * state of every element matching `extraSelectors`, into a timestamped
 * folder under DEBUG_DIR. Never throws — a failed debug dump shouldn't
 * mask the real error it was called to help diagnose.
 *
 * @param {import('playwright').Page} page
 * @param {string} label short reason, e.g. "continue-button-not-found"
 * @param {string[]} extraSelectors CSS selectors to inspect individually
 * @returns {Promise<string|null>} the folder path, or null on failure
 */
async function captureDebugSnapshot(page, label, extraSelectors = []) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = path.join(DEBUG_DIR, `${timestamp}_${safeSlug(label)}`);
    fs.mkdirSync(folder, { recursive: true });

    await page.screenshot({
      path: path.join(folder, "screenshot.png"),
      fullPage: true,
    });

    const html = await page.content();
    fs.writeFileSync(path.join(folder, "page.html"), html, "utf8");

    const elements = await page.evaluate((selectors) => {
      return selectors.map((selector) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        return {
          selector,
          count: nodes.length,
          matches: nodes.map((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return {
              outerHTML: el.outerHTML,
              className: el.className,
              disabledAttribute: el.disabled ?? null,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              display: style.display,
              visibility: style.visibility,
            };
          }),
        };
      });
    }, extraSelectors);

    fs.writeFileSync(
      path.join(folder, "elements.json"),
      JSON.stringify({ url: page.url(), label, elements }, null, 2),
      "utf8",
    );

    console.warn(`[debug] snapshot guardado em ${folder}`);
    return folder;
  } catch (err) {
    console.warn(`[debug] falhou a capturar snapshot: ${err.message}`);
    return null;
  }
}

module.exports = { captureDebugSnapshot, debugLog };
