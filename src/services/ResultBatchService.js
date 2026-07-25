"use strict";

const scrapeCallback = require("./ScrapeCallback");

const DEFAULT_BATCH_SIZE = 100;

/**
 * Buffers scraped results and flushes them to Laravel in fixed-size batches,
 * reusing the existing ScrapeCallback webhook instead of holding an entire
 * run's results in memory until the job finishes.
 *
 */
class ResultBatchService {
  constructor({
    callbackUrl,
    runToken,
    jobToken,
    batchSize = DEFAULT_BATCH_SIZE,
    attempt = 0,
  }) {
    this.callbackUrl = callbackUrl;
    this.runToken = runToken;
    this.jobToken = jobToken;
    this.batchSize = batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;
    // BullMQ's attemptsMade for this job run. Lets Laravel tell apart
    // batches from a superseded attempt (after a retry) from the current one.
    this.attempt = attempt;

    this.buffer = [];
    // Kept separately (not cleared on flush) so the final callback can report
    // only the failures without re-sending everything already streamed.
    this.failedEntries = [];
    this.sentCount = 0;
  }

  /**
   * Adds one result entry (success or failure payload) to the buffer.
   * Auto-flushes as soon as the buffer reaches batchSize.
   */
  async add(entry, { isError = false } = {}) {
    this.buffer.push(entry);
    if (isError) this.failedEntries.push(entry);

    // No 'await' between the length check and the splice below in flush(),
    // so concurrent lanes can never race past this point mid-flush.
    if (this.buffer.length >= this.batchSize) {
      await this.flush("partial");
    }
  }

  /**
   * Sends whatever is currently buffered.
   */
  async flush(status = "partial") {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    this.sentCount += batch.length;

    await scrapeCallback.send(
      this.callbackUrl,
      {
        status,
        job_token: this.jobToken,
        attempt: this.attempt,
        books: batch,
      },
      this.runToken,
    );
  }

  getFailedEntries() {
    return [...this.failedEntries];
  }

  getSentCount() {
    return this.sentCount;
  }
}

module.exports = ResultBatchService;