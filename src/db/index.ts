import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
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
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER REFERENCES foods(id),
      quantity_grams REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL DEFAULT '',
      meal_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY,
      calories REAL NOT NULL DEFAULT 2000,
      protein REAL NOT NULL DEFAULT 150,
      carbs REAL NOT NULL DEFAULT 250,
      fat REAL NOT NULL DEFAULT 70
    );

    INSERT OR IGNORE INTO goals (id) VALUES (1);
  `);

  // Migrate existing DBs: add new columns if missing
  const migrations = [
    "ALTER TABLE foods ADD COLUMN barcode TEXT",
    "ALTER TABLE foods ADD COLUMN openfoodfacts_id TEXT",
    "ALTER TABLE foods ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
    "ALTER TABLE entries ADD COLUMN date TEXT NOT NULL DEFAULT ''",
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
}
