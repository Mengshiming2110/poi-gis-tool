import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import type { Task, PoiRecord, TaskStatus } from './types';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    mode        TEXT NOT NULL,
    categories  TEXT NOT NULL,
    grid_size   REAL,
    region_geo  TEXT,
    status      TEXT DEFAULT 'pending',
    total_cells INTEGER DEFAULT 0,
    done_cells  INTEGER DEFAULT 0,
    total_pois  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pois (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      TEXT NOT NULL REFERENCES tasks(id),
    name         TEXT NOT NULL,
    category     TEXT,
    subcategory  TEXT,
    address      TEXT,
    lng          REAL NOT NULL,
    lat          REAL NOT NULL,
    phone        TEXT,
    rating       REAL,
    collected_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pois_task ON pois(task_id);
  CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);
`);

export function createTask(task: Omit<Task, 'created_at'>): Task {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, mode, categories, grid_size, region_geo, status, total_cells, done_cells, total_pois)
    VALUES (@id, @mode, @categories, @grid_size, @region_geo, @status, @total_cells, @done_cells, @total_pois)
  `);
  stmt.run(task);
  return getTask(task.id)!;
}

export function getTask(id: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return row as Task;
}

export function updateTaskStatus(id: string, status: TaskStatus): void {
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
}

export function incrementTaskProgress(id: string, newPois: number): void {
  db.prepare(`
    UPDATE tasks SET done_cells = done_cells + 1, total_pois = total_pois + ? WHERE id = ?
  `).run(newPois, id);
}

export function insertPois(taskId: string, pois: Omit<PoiRecord, 'id' | 'task_id' | 'collected_at'>[]): number {
  const stmt = db.prepare(`
    INSERT INTO pois (task_id, name, category, subcategory, address, lng, lat, phone, rating)
    VALUES (@task_id, @name, @category, @subcategory, @address, @lng, @lat, @phone, @rating)
  `);
  const insertMany = db.transaction((items: typeof pois) => {
    for (const item of items) {
      stmt.run({ task_id: taskId, ...item });
    }
    return items.length;
  });
  return insertMany(pois);
}

export function queryPois(params: {
  taskId: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): { pois: PoiRecord[]; total: number } {
  const conditions: string[] = ['task_id = ?'];
  const values: any[] = [params.taskId];

  if (params.search) {
    conditions.push('name LIKE ?');
    values.push(`%${params.search}%`);
  }
  if (params.category) {
    conditions.push('category = ?');
    values.push(params.category);
  }

  const where = conditions.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) as count FROM pois WHERE ${where}`).get(...values) as any).count;
  const pois = db.prepare(
    `SELECT * FROM pois WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`
  ).all(...values, params.pageSize, (params.page - 1) * params.pageSize) as PoiRecord[];

  return { pois, total };
}

export function getTaskPoisForExport(taskId: string): PoiRecord[] {
  return db.prepare('SELECT * FROM pois WHERE task_id = ? ORDER BY id').all(taskId) as PoiRecord[];
}

export function getAllTasks(): Task[] {
  return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as Task[];
}

export default db;
