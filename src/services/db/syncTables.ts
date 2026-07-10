// Declarative registry of the tables that participate in device-to-device
// sync. Used by initDB() to generate the sync triggers and by the sync engine
// (src/features/settings/services/syncEngine.ts) to translate foreign keys
// and order operations. See SYNC.md for the full concept.
//
// Order matters: tables are listed parents-before-children so that pulled
// upserts can resolve foreign keys, and pushed/applied deletes run in reverse.
//
// NOT in this list (and therefore never synced): sync_queue, sync_meta,
// sync_row_versions, and everything in SecureStore (AI API keys, the sync
// password itself).

export interface SyncTableDef {
    /** SQLite table name. */
    name: string;
    /** FK columns → the table they reference. Values are translated to the
     *  referenced row's uuid on push and back to local ids on pull. */
    fks?: Record<string, string>;
    /** Self-referencing FK column: rows with NULL in it are applied first. */
    selfRefColumn?: string;
    /** For single-row settings tables: the fixed local id of that row. The
     *  row syncs under a deterministic uuid and is never deleted. */
    singletonId?: number;
    /** Legacy columns that exist in old installs but are not synced. */
    excludeColumns?: string[];
}

export const SYNC_TABLES: SyncTableDef[] = [
    { name: "foods" },
    { name: "serving_units", fks: { food_id: "foods" } },
    { name: "recipes", fks: { parent_recipe_id: "recipes" }, selfRefColumn: "parent_recipe_id" },
    { name: "recipe_items", fks: { recipe_id: "recipes", food_id: "foods" } },
    { name: "recipe_logs", fks: { recipe_id: "recipes" } },
    {
        name: "entries",
        fks: { food_id: "foods", recipe_log_id: "recipe_logs" },
        // Legacy columns superseded by recipe_log_id; only present on old installs.
        excludeColumns: ["recipe_id", "recipe_log_group", "recipe_portion"],
    },
    { name: "weight_logs" },
    { name: "goals", singletonId: 1 },
    { name: "goal_history" },
    { name: "notification_settings", singletonId: 1 },
    { name: "ai_memories" },
    { name: "chat_sessions" },
    { name: "chat_messages", fks: { session_id: "chat_sessions" } },
    { name: "exercise_templates" },
    { name: "workouts" },
    { name: "workout_exercises", fks: { workout_id: "workouts", exercise_template_id: "exercise_templates" } },
    { name: "exercise_sets", fks: { workout_exercise_id: "workout_exercises" } },
    { name: "progress_photos", fks: { log_entry_id: "entries", workout_tag_id: "workouts" } },
];

/** The uuid a singleton table's row always syncs under, on every device. */
export function singletonUuid(def: SyncTableDef): string {
    return `singleton-${def.name}-${def.singletonId}`;
}
