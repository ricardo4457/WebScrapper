"use strict";

const { withLaneContext } = require("../utils/LaneContext");

// Default number of parallel discovery lanes.
const DEFAULT_DISCOVERY_LANES = 4;

/**
 * Runs the discovery phase using multiple parallel lanes.
 *
 * Each lane uses its own browser context and processes
 * a subset of discovery units independently.
 */
class DiscoveryRunner {

  static async run(
    units,
    { browserManager, setupLane, discoverUnit, laneCount = DEFAULT_DISCOVERY_LANES } = {},
  ) {
    if (!browserManager) {
      throw new Error("DiscoveryRunner.run: browserManager is required.");
    }
    if (typeof discoverUnit !== "function") {
      throw new Error("DiscoveryRunner.run: discoverUnit is required.");
    }
    if (!Array.isArray(units) || units.length === 0) {
      return [];
    }

    const resolvedLaneCount = Math.max(1, Math.min(laneCount, units.length));
    const lanes = DiscoveryRunner._partition(units, resolvedLaneCount);

    console.log(
      `[DiscoveryRunner] Discovering ${units.length} unit(s) across ${lanes.length} lane(s) ` +
        `(sizes: ${lanes.map((lane) => lane.length).join(", ")}).`,
    );

    const laneResults = await Promise.all(
      lanes.map((laneUnits) =>
        DiscoveryRunner._runLane(laneUnits, {
          browserManager,
          setupLane,
          discoverUnit,
        }),
      ),
    );

    return laneResults.flat();
  }

  /**
   * Processes all discovery units assigned to a single lane.
   */
  static async _runLane(laneUnits, { browserManager, setupLane, discoverUnit }) {
    return withLaneContext(browserManager, async (context) => {
      const page = await browserManager.openPageInContext(context);
      const results = [];

      try {
        if (setupLane) {
          await setupLane(page);
        }

        for (const unit of laneUnits) {
          const unitResults = await discoverUnit(page, unit);
          if (unitResults && unitResults.length) {
            results.push(...unitResults);
          }
        }
      } finally {
        await page.close().catch(() => {});
      }

      return results;
    });
  }

  /**
   * Distributes discovery units evenly across the available lanes.
   */
  static _partition(units, laneCount) {
    const lanes = Array.from({ length: laneCount }, () => []);
    units.forEach((unit, index) => {
      lanes[index % laneCount].push(unit);
    });
    return lanes.filter((lane) => lane.length > 0);
  }
}

module.exports = DiscoveryRunner;