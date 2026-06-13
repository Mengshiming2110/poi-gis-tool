import initSqlJs, { type Database as SqlJsDatabase, type Statement, type SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import type { Task, PoiRecord, TaskStatus } from './types';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) { fs.mkdirSync(dbDir, { recursive: true }); }

let SQL: SqlJsStatic;
let db: SqlJsDatabase;

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.dbPath, buffer);
}

function rowToObj(stmt: Statement): any {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  const obj: any = {};
  cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
  return obj;
}

export async function initDb(): Promise<void> {
  SQL = await initSqlJs();
  if (fs.existsSync(config.dbPath)) {
    const buf = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
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
      error_message TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  const taskColumns = db.exec('PRAGMA table_info(tasks)')[0]?.values.map(row => row[1]);
  if (taskColumns && !taskColumns.includes('error_message')) {
    db.run('ALTER TABLE tasks ADD COLUMN error_message TEXT');
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS pois (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      category     TEXT,
      subcategory  TEXT,
      address      TEXT,
      lng          REAL NOT NULL,
      lat          REAL NOT NULL,
      phone        TEXT,
      rating       REAL,
      collected_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_pois_task ON pois(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category)');
  saveDb();
}

// --- Task CRUD ---

export function createTask(task: Omit<Task, 'created_at'>): Task {
  db.run(
    `INSERT INTO tasks (id, mode, categories, grid_size, region_geo, status, total_cells, done_cells, total_pois)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.mode, task.categories, task.grid_size, task.region_geo, task.status, task.total_cells, task.done_cells, task.total_pois]
  );
  saveDb();
  return getTask(task.id)!;
}

export function getTask(id: string): Task | undefined {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const obj = rowToObj(stmt);
    stmt.free();
    return obj as Task;
  }
  stmt.free();
  return undefined;
}

export function updateTaskStatus(id: string, status: TaskStatus): void {
  db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
  saveDb();
}

export function failTask(id: string, errorMessage: string): void {
  db.run('UPDATE tasks SET status = ?, error_message = ? WHERE id = ?', ['failed', errorMessage, id]);
  saveDb();
}

export function incrementTaskProgress(id: string, newPois: number): void {
  db.run('UPDATE tasks SET done_cells = done_cells + 1, total_pois = total_pois + ? WHERE id = ?', [newPois, id]);
  saveDb();
}

// --- POI CRUD ---

export function insertPois(taskId: string, pois: Omit<PoiRecord, 'id' | 'task_id' | 'collected_at'>[], skipDup: boolean = false): number {
  db.run('BEGIN');
  const stmt = db.prepare(
    'INSERT INTO pois (task_id, name, category, subcategory, address, lng, lat, phone, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const dedupStmt = skipDup
    ? db.prepare('SELECT COUNT(*) as c FROM pois WHERE name = ? AND ABS(lng - ?) < 0.0005 AND ABS(lat - ?) < 0.0005')
    : null;
  let inserted = 0;
  for (const item of pois) {
    if (dedupStmt) {
      dedupStmt.bind([item.name, item.lng, item.lat]);
      dedupStmt.step();
      const { c } = dedupStmt.getAsObject() as { c: number };
      dedupStmt.reset();
      if (c > 0) continue; // skip duplicate
    }
    stmt.bind([taskId, item.name, item.category, item.subcategory, item.address, item.lng, item.lat, item.phone, item.rating]);
    stmt.step();
    stmt.reset();
    inserted++;
  }
  if (dedupStmt) dedupStmt.free();
  stmt.free();
  db.run('COMMIT');
  saveDb();
  return inserted;
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
  if (params.search) { conditions.push('name LIKE ?'); values.push(`%${params.search}%`); }
  if (params.category) { conditions.push('category = ?'); values.push(params.category); }
  const where = conditions.join(' AND ');

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM pois WHERE ${where}`);
  countStmt.bind(values);
  countStmt.step();
  const total = countStmt.getAsObject().count as number;
  countStmt.free();

  const pois: PoiRecord[] = [];
  const stmt = db.prepare(`SELECT * FROM pois WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`);
  stmt.bind([...values, params.pageSize, (params.page - 1) * params.pageSize]);
  while (stmt.step()) { pois.push(rowToObj(stmt) as PoiRecord); }
  stmt.free();
  return { pois, total };
}

export function getTaskPoisForExport(taskId: string): PoiRecord[] {
  const pois: PoiRecord[] = [];
  const stmt = db.prepare('SELECT * FROM pois WHERE task_id = ? ORDER BY id');
  stmt.bind([taskId]);
  while (stmt.step()) { pois.push(rowToObj(stmt) as PoiRecord); }
  stmt.free();
  return pois;
}

export function getAllTasks(): Task[] {
  const tasks: Task[] = [];
  const stmt = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
  while (stmt.step()) { tasks.push(rowToObj(stmt) as Task); }
  stmt.free();
  return tasks;
}
