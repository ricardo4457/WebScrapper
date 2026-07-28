"use strict";

/**
 * Lightweight timing helper used to measure scraper phases before
 * adjusting concurrency settings.
 *
 * Tracks execution time for named phases during a single strategy run.
 * Timings are attached to the current run/page instance to avoid mixing
 * data when multiple jobs run in parallel.
 */

class RunTimings {
  constructor() {
    this.totals = Object.create(null); // phase -> { count, ms }
    this.startedAt = Date.now();
  }

  /**
   * Executes a function while recording its execution time.
   * The original return value and errors are preserved.
   */
  async track(phase, fn) {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const elapsed = Date.now() - start;
      const entry = this.totals[phase] || { count: 0, ms: 0 };
      entry.count += 1;
      entry.ms += elapsed;
      this.totals[phase] = entry;
    }
  }

  /**
   * Prints a summary with total runtime and phase breakdown.
   */
  logSummary(label = "StrategyRunner") {
    const totalMs = Date.now() - this.startedAt;
    console.log(`[${label}] Run finished in ${(totalMs / 1000).toFixed(1)}s.`);

    const phases = Object.entries(this.totals).sort((a, b) => b[1].ms - a[1].ms);
    for (const [phase, { count, ms }] of phases) {
      const pct = totalMs > 0 ? ((ms / totalMs) * 100).toFixed(1) : "0.0";
      const avg = count > 0 ? (ms / count).toFixed(0) : "0";
      console.log(
        `[${label}]   ${phase}: ${(ms / 1000).toFixed(1)}s total, ` +
          `${count} call(s), avg ${avg}ms/call, ${pct}% of run`,
      );
    }
  }
}

/**
 * Runs timing only when a page has an attached RunTimings instance.
 * Otherwise executes normally without overhead.
 */
async function timed(page, phase, fn) {
  if (page && page.__timings) {
    return page.__timings.track(phase, fn);
  }
  return fn();
}

module.exports = { RunTimings, timed };