'use strict';

const crypto = require('crypto');

// scrape_runs(id, run_token, strategy, status, params, jobs_total, jobs_done, jobs_failed, finished_at, timestamps)
// run_token generated here (Node writes direct to MySQL, skips Laravel's Model::booted()).
// Keep in sync with the run_token the Express/BullMQ callback sends to Laravel.
class ScrapeRunRepository {
  constructor(db) {
    this.db = db;
  }

  async start({ strategy, params, jobs_total }) {
    const run_token = crypto.randomUUID();

    const [result] = await this.db.execute(
      `INSERT INTO scrape_runs (run_token, strategy, status, params, jobs_total)
       VALUES (?, ?, 'running', ?, ?)`,
      [run_token, strategy, JSON.stringify(params ?? {}), jobs_total]
    );

    return { id: result.insertId, run_token };
  }

  async incrementDone(id) {
    await this.db.execute('UPDATE scrape_runs SET jobs_done = jobs_done + 1 WHERE id = ?', [id]);
  }

  async incrementFailed(id) {
    await this.db.execute('UPDATE scrape_runs SET jobs_failed = jobs_failed + 1 WHERE id = ?', [id]);
  }

  async finish(id, status = 'done') {
    await this.db.execute(
      'UPDATE scrape_runs SET status = ?, finished_at = NOW() WHERE id = ?',
      [status, id]
    );
  }

  async findById(id) {
    const [[row]] = await this.db.execute('SELECT * FROM scrape_runs WHERE id = ?', [id]);
    return row ?? null;
  }

  async findByToken(run_token) {
    const [[row]] = await this.db.execute('SELECT * FROM scrape_runs WHERE run_token = ?', [run_token]);
    return row ?? null;
  }
}

module.exports = { ScrapeRunRepository };