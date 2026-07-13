import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";
import { SYNC_TABLES, singletonUuid } from "./syncTables";

const DB_NAME = "macroflow.db";

export const expoDb = openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

export function initDB() {
  expoDb.execSync(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories_per_100g REAL NOT NULL DEFAULT 0,
      protein_per_100g REAL NOT NULL DEFAULT 0,
      carbs_per_100g REAL NOT NULL DEFAULT 0,
      fat_per_100g REAL NOT NULL DEFAULT 0,
      barcode TEXT,
      openfoodfacts_id TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      default_unit TEXT NOT NULL DEFAULT 'g',
      serving_size REAL NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      portion REAL NOT NULL DEFAULT 1,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER REFERENCES foods(id),
      quantity_grams REAL NOT NULL,
      quantity_unit TEXT NOT NULL DEFAULT 'g',
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL DEFAULT '',
      meal_type TEXT NOT NULL,
      recipe_log_id INTEGER REFERENCES recipe_logs(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY,
      calories REAL NOT NULL DEFAULT 2000,
      protein REAL NOT NULL DEFAULT 150,
      carbs REAL NOT NULL DEFAULT 250,
      fat REAL NOT NULL DEFAULT 70,
      unit_system TEXT NOT NULL DEFAULT 'metric',
      keep_awake INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS goal_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      food_id INTEGER NOT NULL REFERENCES foods(id),
      quantity_grams REAL NOT NULL,
      quantity_unit TEXT NOT NULL DEFAULT 'g'
    );

    CREATE TABLE IF NOT EXISTS serving_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER NOT NULL REFERENCES foods(id),
      name TEXT NOT NULL,
      grams REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      date TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      breakfast_time TEXT NOT NULL DEFAULT '08:00',
      lunch_time TEXT NOT NULL DEFAULT '12:00',
      dinner_time TEXT NOT NULL DEFAULT '18:00',
      snack_time TEXT NOT NULL DEFAULT '15:00',
      weight_time TEXT NOT NULL DEFAULT '07:30'
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_call_json TEXT,
      tool_result_json TEXT,
      tool_result_data_json TEXT,
      tool_call_id TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
      resistance_mode TEXT NOT NULL DEFAULT 'resistance',
      default_weight_unit TEXT NOT NULL DEFAULT 'kg',
      notes TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      notes TEXT,
      is_scheduled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id),
      exercise_template_id INTEGER NOT NULL REFERENCES exercise_templates(id),
      sort_order INTEGER NOT NULL,
      notes TEXT,
      started_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS exercise_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id),
      set_order INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'working',
      weight REAL,
      weight_unit TEXT NOT NULL DEFAULT 'kg',
      reps INTEGER,
      duration_seconds INTEGER,
      distance_meters REAL,
      rir INTEGER,
      rest_seconds INTEGER,
      completed_at INTEGER,
      is_scheduled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS progress_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_entry_id INTEGER REFERENCES entries(id),
      image_path TEXT,
      image_data TEXT,
      workout_tag_id INTEGER REFERENCES workouts(id),
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO goals (id) VALUES (1);
    INSERT OR IGNORE INTO notification_settings (id) VALUES (1);
  `);

  // Migrate existing DBs: add new columns if missing
  const migrations = [
    "ALTER TABLE foods ADD COLUMN barcode TEXT",
    "ALTER TABLE foods ADD COLUMN openfoodfacts_id TEXT",
    "ALTER TABLE foods ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
    "ALTER TABLE entries ADD COLUMN date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE entries ADD COLUMN recipe_id INTEGER",
    "ALTER TABLE entries ADD COLUMN recipe_log_group TEXT",
    "ALTER TABLE foods ADD COLUMN default_unit TEXT NOT NULL DEFAULT 'g'",
    "ALTER TABLE foods ADD COLUMN serving_size REAL NOT NULL DEFAULT 100",
    "ALTER TABLE entries ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'g'",
    "ALTER TABLE goals ADD COLUMN unit_system TEXT NOT NULL DEFAULT 'metric'",
    "ALTER TABLE recipe_items ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'g'",
    "ALTER TABLE entries ADD COLUMN recipe_portion REAL NOT NULL DEFAULT 1",
    "ALTER TABLE entries ADD COLUMN recipe_log_id INTEGER REFERENCES recipe_logs(id)",
    "ALTER TABLE goals ADD COLUMN language TEXT NOT NULL DEFAULT 'en'",
    "ALTER TABLE foods ADD COLUMN last_logged_amount REAL",
    "ALTER TABLE foods ADD COLUMN last_logged_unit TEXT",
    "ALTER TABLE goals ADD COLUMN appearance_mode TEXT NOT NULL DEFAULT 'system'",
    "ALTER TABLE goals ADD COLUMN keep_awake INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE foods ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE recipes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE foods ADD COLUMN last_logged_meal TEXT",
    "ALTER TABLE notification_settings ADD COLUMN breakfast_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN lunch_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN dinner_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN snack_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN weight_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE entries ADD COLUMN is_scheduled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE exercise_templates ADD COLUMN custom_fields TEXT",
    "ALTER TABLE exercise_sets ADD COLUMN custom_values TEXT",
    "ALTER TABLE recipes ADD COLUMN parent_recipe_id INTEGER REFERENCES recipes(id)",
    "ALTER TABLE goals ADD COLUMN exercise_timer_sound TEXT NOT NULL DEFAULT 'off'",
    // Sync: stable cross-device row identity (see SYNC.md)
    ...SYNC_TABLES.map((t) => `ALTER TABLE ${t.name} ADD COLUMN uuid TEXT`),
  ];
  for (const sql of migrations) {
    try { expoDb.execSync(sql); } catch { /* column already exists */ }
  }

  // Backfill date column for existing entries that have no date set
  expoDb.execSync(`
    UPDATE entries
    SET date = strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime')
    WHERE date = '';
  `);

  // Migrate legacy recipe_log_group entries to recipe_logs table.
  // Each distinct (recipe_id, recipe_log_group) becomes a recipe_logs row,
  // and the entries are linked via recipe_log_id.
  const legacyGroups = expoDb.getAllSync<{
    recipe_id: number;
    recipe_log_group: string;
    date: string;
    meal_type: string;
    recipe_portion: number;
    timestamp: number;
  }>(`
    SELECT DISTINCT recipe_id, recipe_log_group, date, meal_type,
           recipe_portion, MIN(timestamp) as timestamp
    FROM entries
    WHERE recipe_log_group IS NOT NULL AND recipe_log_id IS NULL
    GROUP BY recipe_log_group
  `);
  for (const g of legacyGroups) {
    const result = expoDb.runSync(
      `INSERT INTO recipe_logs (recipe_id, date, meal_type, portion, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [g.recipe_id, g.date, g.meal_type, g.recipe_portion ?? 1, g.timestamp],
    );
    const newId = result.lastInsertRowId;
    expoDb.runSync(
      `UPDATE entries SET recipe_log_id = ? WHERE recipe_log_group = ?`,
      [newId, g.recipe_log_group],
    );
  }

  // Seed goal history for existing installs: without a starting snapshot, past
  // days would have no goal to resolve to. Backfill the current goals dated at
  // the epoch so every existing/past day keeps using them, while future goal
  // changes only affect days from the day they were made onward.
  const goalHistoryCount = expoDb.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM goal_history`,
  );
  if (!goalHistoryCount || goalHistoryCount.count === 0) {
    expoDb.execSync(`
      INSERT INTO goal_history (date, calories, protein, carbs, fat)
      SELECT '1970-01-01', calories, protein, carbs, fat FROM goals WHERE id = 1;
    `);
  }

  initSyncInfrastructure();
}

// ── Sync infrastructure (see SYNC.md) ──────────────────────
// Every synced table gets a `uuid` (stable cross-device identity, added in
// the migrations list above) and a set of AFTER INSERT/UPDATE/DELETE triggers
// that record changes into the `sync_queue` oplog. The triggers no-op while
// the sync engine is applying remote changes (sync_meta key 'sync_applying').

/** Current time in ms since epoch, as a SQL expression (for trigger bodies). */
const NOW_MS_SQL = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

function initSyncInfrastructure() {
  expoDb.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_uuid TEXT NOT NULL,
      op TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_row_versions (
      table_name TEXT NOT NULL,
      row_uuid TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_row ON sync_queue (table_name, row_uuid);
  `);

  // Singleton settings rows sync under the same deterministic uuid on every
  // device so they merge into one logical row. Enforced every start because a
  // backup import can replace the row with a foreign/missing uuid.
  for (const t of SYNC_TABLES) {
    if (t.singletonId == null) continue;
    expoDb.runSync(
      `UPDATE ${t.name} SET uuid = ? WHERE id = ? AND (uuid IS NULL OR uuid <> ?)`,
      [singletonUuid(t), t.singletonId, singletonUuid(t)],
    );
  }

  // Backfill uuids for rows that predate the sync feature. Runs before the
  // triggers are (first) created, so the backfill itself is not recorded.
  for (const t of SYNC_TABLES) {
    expoDb.execSync(
      `UPDATE ${t.name} SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL`,
    );
    expoDb.execSync(`CREATE INDEX IF NOT EXISTS idx_${t.name}_uuid ON ${t.name} (uuid)`);
  }

  const applyingGuard =
    "NOT EXISTS (SELECT 1 FROM sync_meta WHERE key = 'sync_applying' AND value = '1')";
  for (const t of SYNC_TABLES) {
    expoDb.execSync(`
      CREATE TRIGGER IF NOT EXISTS sync_trg_${t.name}_insert AFTER INSERT ON ${t.name}
      BEGIN
        UPDATE ${t.name} SET uuid = lower(hex(randomblob(16))) WHERE id = NEW.id AND uuid IS NULL;
        INSERT INTO sync_queue (table_name, row_uuid, op, updated_at)
        SELECT '${t.name}', uuid, 'upsert', ${NOW_MS_SQL} FROM ${t.name}
        WHERE id = NEW.id AND ${applyingGuard};
      END;

      CREATE TRIGGER IF NOT EXISTS sync_trg_${t.name}_update AFTER UPDATE ON ${t.name}
      WHEN OLD.uuid IS NOT NULL AND ${applyingGuard}
      BEGIN
        INSERT INTO sync_queue (table_name, row_uuid, op, updated_at)
        VALUES ('${t.name}', NEW.uuid, 'upsert', ${NOW_MS_SQL});
      END;

      CREATE TRIGGER IF NOT EXISTS sync_trg_${t.name}_delete AFTER DELETE ON ${t.name}
      WHEN OLD.uuid IS NOT NULL AND ${applyingGuard}
      BEGIN
        INSERT INTO sync_queue (table_name, row_uuid, op, updated_at)
        VALUES ('${t.name}', OLD.uuid, 'delete', ${NOW_MS_SQL});
      END;
    `);
  }
}
