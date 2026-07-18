"use strict";

const SEL = require("../selectors");

/**
 * Returns the current map tooltip text.
 */
async function readTooltipText(page) {
  return page.evaluate((tooltipSelector) => {
    const tooltip = document.querySelector(tooltipSelector);
    if (!tooltip) return null;
    const style = window.getComputedStyle(tooltip);
    if (style.display === "none" || style.opacity === "0") return null;
    return tooltip.textContent?.trim() || null;
  }, SEL.MAP_TOOLTIP);
}

/**
 * Hovers a map shape and waits for its tooltip.
 */
async function hoverAndReadTooltip(
  page,
  elementHandle,
  { timeout = 3000 } = {},
) {
  const box = await elementHandle.boundingBox();
  if (!box) return null;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const deadline = Date.now() + timeout;
  let text = await readTooltipText(page);
  while (!text && Date.now() < deadline) {
    await page.waitForTimeout(50); // passo de polling, não um sleep às cegas
    text = await readTooltipText(page);
  }
  return text;
}

/**
 * Clicks the map shape matching the given tooltip.
 */

async function clickMapShapeByTooltip(page, name) {
  await page.waitForSelector(`${SEL.CONTENT_MAP} svg`, {
    state: "visible",
    timeout: 10000,
  });

  const contentMap = page.locator(SEL.CONTENT_MAP);
  const shapes = await contentMap
    .locator(SEL.CONTENT_MAP_SHAPES)
    .elementHandles();
  const target = name.trim().toUpperCase();

  for (const shape of shapes) {
    const tooltip = await hoverAndReadTooltip(page, shape);
    if (tooltip && tooltip.toUpperCase() === target) {
      await shape.click();
      return;
    }
  }

  throw new Error(
    `clickMapShapeByTooltip: "${name}" não encontrado entre ${shapes.length} elementos do mapa.`,
  );
}

/**
 * Returns all visible map labels.
 */
async function discoverMapLabels(page) {
  await page.waitForSelector(`${SEL.CONTENT_MAP} svg`, {
    state: "visible",
    timeout: 10000,
  });

  const contentMap = page.locator(SEL.CONTENT_MAP);
  const shapes = await contentMap
    .locator(SEL.CONTENT_MAP_SHAPES)
    .elementHandles();

  const labels = [];
  for (const shape of shapes) {
    const tooltip = await hoverAndReadTooltip(page, shape);
    if (tooltip) labels.push(tooltip);
  }
  return labels;
}

/**
 * Selects a district from the map.
 */
async function selectDistrictViaMap(page, district) {
  await clickMapShapeByTooltip(page, district);
}

/**
 * Selects a city from the map.
 */
async function selectCityViaMap(page, city) {
  await clickMapShapeByTooltip(page, city);
}

async function discoverDistrictsViaMap(page) {
  return discoverMapLabels(page);
}

async function discoverCitiesViaMap(page) {
  return discoverMapLabels(page);
}

module.exports = {
  readTooltipText,
  hoverAndReadTooltip,
  clickMapShapeByTooltip,
  discoverMapLabels,
  selectDistrictViaMap,
  selectCityViaMap,
  discoverDistrictsViaMap,
  discoverCitiesViaMap,
};
