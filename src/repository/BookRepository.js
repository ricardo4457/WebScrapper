'use strict';

// books(id, title, publisher, cover_path, price, discipline, type, timestamps)
// dedup key: (title, publisher). LAST_INSERT_ID(id) makes insertId correct on updates too.

class BookRepository {
  constructor(db) {
    this.db = db;
  }

  async upsert({ title, publisher, cover_path, price, discipline, type }) {
    const [result] = await this.db.execute(
      `INSERT INTO books (title, publisher, cover_path, price, discipline, type)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cover_path = VALUES(cover_path),
         price      = VALUES(price),
         discipline = VALUES(discipline),
         type       = VALUES(type),
         id         = LAST_INSERT_ID(id),
         updated_at = NOW()`,
      [title, publisher, cover_path, price, discipline, type]
    );
    return result.insertId;
  }

  async findByTitleAndPublisher(title, publisher) {
    const [rows] = await this.db.execute(
      'SELECT * FROM books WHERE title = ? AND publisher = ? LIMIT 1',
      [title, publisher]
    );
    return rows[0] ?? null;
  }

  async stats() {
    const [[row]] = await this.db.execute('SELECT COUNT(*) AS total FROM books');
    return row.total;
  }
}

module.exports = { BookRepository };