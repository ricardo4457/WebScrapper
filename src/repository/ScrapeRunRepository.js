export class ScrapeRunRepository {
  constructor(db) { this.db = db; }

  async start({ strategy, params, jobs_total }) {
    const [result] = await this.db.execute(
      `INSERT INTO scrape_runs (strategy, status, params, jobs_total)
       VALUES (?, 'running', ?, ?)`,
      [strategy, JSON.stringify(params ?? {}), jobs_total]
    );
    return result.insertId;
  }

  async incrementDone(id) {
    await this.db.execute(
      'UPDATE scrape_runs SET jobs_done = jobs_done + 1 WHERE id = ?',
      [id]
    );
  }

  async incrementFailed(id) {
    await this.db.execute(
      'UPDATE scrape_runs SET jobs_failed = jobs_failed + 1 WHERE id = ?',
      [id]
    );
  }

  async finish(id, status = 'done') {
    await this.db.execute(
      `UPDATE scrape_runs
       SET status = ?, finished_at = NOW()
       WHERE id = ?`,
      [status, id]
    );
  }

  async findById(id) {
    const [[row]] = await this.db.execute(
      'SELECT * FROM scrape_runs WHERE id = ?',
      [id]
    );
    return row ?? null;
  }
}
