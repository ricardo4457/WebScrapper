export class SchoolRepository {
  constructor(db) { this.db = db; }

  async upsert({ district, city, schools }) {
    for (const name of schools) {
      await this.db.execute(
        `INSERT INTO schools (district, city, name)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [district, city, name]
      );
    }
  }

  async stats() {
    const [[row]] = await this.db.execute(
      'SELECT COUNT(*) AS total FROM schools'
    );
    return row.total;
  }
}
