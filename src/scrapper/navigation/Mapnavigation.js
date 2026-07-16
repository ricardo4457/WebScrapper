'use strict';

const SEL = require('../selectors');
const { sleep } = require('../browser');

/** Reads the current tooltip text on the district/city SVG map, or null if hidden. */
async function getMapTooltipText(page) {
  return page.evaluate(sel => {
    const tooltip = document.querySelector(sel);
    if (!tooltip) return null;
    const style = window.getComputedStyle(tooltip);
    if (style.display === 'none' || style.opacity === '0') return null;
    return tooltip.textContent?.trim() || null;
  }, SEL.MAP_TOOLTIP);
}

/**
 * Selects a district or city on the SVG map (#content-map) by hovering each
 * shape until its tooltip matches `name` (case-insensitive), then clicks it.
 * Alternative to selectDistrict()/selectCity() (comboNavigation.js) while
 * CITY_COMBO/SCHOOL_COMBO are [UNVERIFIED] in selectors.js.
 */
async function selectMapRegion(page, name) {
  await page.waitForSelector(`${SEL.CONTENT_MAP} svg`, { state: 'visible', timeout: 12000 });

  const contentMap = page.locator(SEL.CONTENT_MAP);
  const elements = await contentMap.locator(SEL.CONTENT_MAP_SHAPES).elementHandles();

  for (const el of elements) {
    const box = await el.boundingBox();
    if (!box) continue;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(400);

    const tooltip = await getMapTooltipText(page);
    if (tooltip?.toUpperCase() === name.toUpperCase()) {
      await el.click();
      await sleep(800); // espera carregar cidades/escolas
      return;
    }
  }

  throw new Error(`selectMapRegion: "${name}" não encontrado no mapa.`);
}

/** District selection via SVG map (instead of DISTRICT_COMBO). */
async function selectDistrictViaMap(page, district) {
  await selectMapRegion(page, district);
}

/** City selection via SVG map (instead of CITY_COMBO). */
async function selectCityViaMap(page, city) {
  await selectMapRegion(page, city);
}

module.exports = {
  getMapTooltipText,
  selectMapRegion,
  selectDistrictViaMap,
  selectCityViaMap,
};