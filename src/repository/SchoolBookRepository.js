'use strict';

// school_books(id, school_id, book_id, year, teaching_cycle, timestamps)
// pivot table, assumes UNIQUE(school_id, book_id, year, teaching_cycle).
// year is free text ("Pré-Escolar" etc), not a number.
class SchoolBookRepository {
  constructor(db) {
    this.db = db;
  }

  async upsert({ book_id, school_id, year, teaching_cycle }) {
    await this.db.execute(
      `INSERT INTO school_books (book_id, school_id, year, teaching_cycle)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         teaching_cycle = VALUES(teaching_cycle),
         updated_at     = NOW()`,
      [book_id, school_id, year, teaching_cycle]
    );
  }

  async findBySchoolAndYear(school_id, year) {
    const [rows] = await this.db.execute(
      `SELECT sb.*, b.title, b.publisher, b.price
       FROM school_books sb
       JOIN books b ON b.id = sb.book_id
       WHERE sb.school_id = ? AND sb.year = ?`,
      [school_id, year]
    );
    return rows;
  }

  async stats() {
    const [[row]] = await this.db.execute('SELECT COUNT(*) AS total FROM school_books');
    return row.total;
  }
}

module.exports = { SchoolBookRepository };
