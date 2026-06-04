export class BookRepository {
  constructor(db) { this.db = db; }

  async upsert({ title, publisher, cover_path, price, discipline, type }) {
    const [result] = await this.db.execute(
      `INSERT INTO books (title, publisher, cover_path, price, discipline, type)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         publisher  = VALUES(publisher),
         cover_path = VALUES(cover_path),
         price      = VALUES(price),
         updated_at = NOW()`,
      [title, publisher, cover_path, price, discipline, type]
    );
    return result.insertId || result.insertId === 0 ? result.insertId : null;
  }

  async findByTitle(title) {
    const [rows] = await this.db.execute(
      'SELECT * FROM books WHERE title = ? LIMIT 1',
      [title]
    );
    return rows[0] ?? null;
  }

  async stats() {
    const [[row]] = await this.db.execute(
      'SELECT COUNT(*) AS total FROM books'
    );
    return row.total;
  }
}
