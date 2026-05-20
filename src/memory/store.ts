import { getDb } from './migrations.js';
import { ChatMessage, ToolCall } from '../llm/provider.js';

export interface DbMessage {
  id: number;
  user_id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  created_at: string;
}

export interface DbSummary {
  id: number;
  user_id: number;
  summary: string;
  messages_from_id: number;
  messages_to_id: number;
}

export class MemoryStore {
  saveMessage(userId: number, message: ChatMessage): number {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO messages (user_id, role, content, tool_calls, tool_call_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      userId,
      message.role,
      message.content || '',
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_call_id || null
    );

    return info.lastInsertRowid as number;
  }

  getRecentMessages(userId: number, limit: number = 20): DbMessage[] {
    const db = getDb();
    // Busca do mais recente para o mais antigo, depois inverte
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `);
    const rows = stmt.all(userId, limit) as DbMessage[];
    return rows.reverse();
  }

  getMessagesBetween(userId: number, fromId: number, toId: number): DbMessage[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE user_id = ? AND id >= ? AND id <= ?
      ORDER BY id ASC
    `);
    return stmt.all(userId, fromId, toId) as DbMessage[];
  }

  getMessageCount(userId: number): number {
    const db = getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ?');
    const result = stmt.get(userId) as { count: number };
    return result.count;
  }

  saveSummary(userId: number, summary: string, fromId: number, toId: number): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO summaries (user_id, summary, messages_from_id, messages_to_id)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, summary, fromId, toId);
  }

  getLatestSummary(userId: number): DbSummary | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM summaries
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `);
    return (stmt.get(userId) as DbSummary) || null;
  }

  clearUserMemory(userId: number): void {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM summaries WHERE user_id = ?').run(userId);
  }
}

export const memoryStore = new MemoryStore();
