const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'library.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    panel TEXT DEFAULT 'main' NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subsections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(section_id, name),
    FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    subsection_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subsection_id) REFERENCES subsections(id) ON DELETE CASCADE
  );
`);

// Safe migration: check if panel column exists in sections table
try {
  const columns = db.prepare('PRAGMA table_info(sections)').all();
  const hasPanelCol = columns.some(c => c.name === 'panel');
  if (!hasPanelCol) {
    db.exec(`ALTER TABLE sections ADD COLUMN panel TEXT DEFAULT 'main';`);
    db.exec(`UPDATE sections SET panel = 'main' WHERE panel IS NULL OR panel = '';`);
  }
} catch (migErr) {
  console.warn('Migration note for sections table:', migErr.message);
}

module.exports = db;
