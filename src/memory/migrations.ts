import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

let db: Database.Database;

export function initDatabase() {
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL'); // Melhor performance para concorrência

  logger.info('Inicializando banco de dados...');

  // Tabela de mensagens
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, id DESC);
  `);

  // Tabela de resumos (memória comprimida)
  db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      messages_from_id INTEGER NOT NULL,
      messages_to_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_summaries_user ON summaries(user_id, id DESC);
  `);

  logger.info('Banco de dados inicializado com sucesso.');
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
