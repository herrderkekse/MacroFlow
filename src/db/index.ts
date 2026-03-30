import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

const DB_NAME = "macroflow.db";

const expoDb = openDatabaseSync(DB_NAME);
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
      unit_system TEXT NOT NULL DEFAULT 'metric'
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
    "ALTER TABLE foods ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE recipes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE foods ADD COLUMN last_logged_meal TEXT",
    "ALTER TABLE notification_settings ADD COLUMN breakfast_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN lunch_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN dinner_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN snack_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notification_settings ADD COLUMN weight_enabled INTEGER NOT NULL DEFAULT 1",
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
}
