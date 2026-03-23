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
      fat_per_100g REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER REFERENCES foods(id),
      quantity_grams REAL NOT NULL,
      timestamp INTEGER NOT NULL,
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
}
