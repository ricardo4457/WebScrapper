'use strict';

// schools(id, district, city, name, timestamps)
// assumes UNIQUE(name). Returns ids so callers can link into school_books.
class SchoolRepository {
  constructor(db) {
    this.db = db;
  }

  async upsertOne({ district, city, name }) {
    const [result] = await this.db.execute(
      `INSERT INTO schools (district, city, name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         district   = VALUES(district),
         city       = VALUES(city),
         id         = LAST_INSERT_ID(id),
         updated_at = NOW()`,
      [district, city, name]
    );
    return result.insertId;
  }

  // Returns Map<name, id>
  async upsert({ district, city, schools }) {
    const ids = new Map();
    for (const name of schools) {
      ids.set(name, await this.upsertOne({ district, city, name }));
    }
    return ids;
  }

  async findByName(name) {
    const [rows] = await this.db.execute(
      'SELECT * FROM schools WHERE name = ? LIMIT 1',
      [name]
    );
    return rows[0] ?? null;
  }

  async stats() {
    const [[row]] = await this.db.execute('SELECT COUNT(*) AS total FROM schools');
    return row.total;
  }
}

module.exports = { SchoolRepository };