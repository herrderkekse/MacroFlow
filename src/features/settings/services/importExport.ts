import { db } from "@/src/services/db";
import {
    aiMemories,
    chatMessages,
    chatSessions,
    entries,
    exerciseSets,
    exerciseTemplates,
    foods,
    goals,
    notificationSettings,
    recipeItems,
    recipeLogs,
    recipes,
    servingUnits,
    weightLogs,
    workoutExercises,
    workouts,
} from "@/src/services/db/schema";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// ── Types ──────────────────────────────────────────────────

interface ExportPayload {
    version: 1;
    exportedAt: string;
    foods: (typeof foods.$inferSelect)[];
    entries: (typeof entries.$inferSelect)[];
    goals: (typeof goals.$inferSelect)[];
    recipes: (typeof recipes.$inferSelect)[];
    recipeItems: (typeof recipeItems.$inferSelect)[];
    recipeLogs?: (typeof recipeLogs.$inferSelect)[];
    weightLogs?: (typeof weightLogs.$inferSelect)[];
    servingUnits?: (typeof servingUnits.$inferSelect)[];
    notificationSettings?: (typeof notificationSettings.$inferSelect)[];
    chatSessions?: (typeof chatSessions.$inferSelect)[];
    chatMessages?: (typeof chatMessages.$inferSelect)[];
    aiMemories?: (typeof aiMemories.$inferSelect)[];
    exerciseTemplates?: (typeof exerciseTemplates.$inferSelect)[];
    workouts?: (typeof workouts.$inferSelect)[];
    workoutExercises?: (typeof workoutExercises.$inferSelect)[];
    exerciseSets?: (typeof exerciseSets.$inferSelect)[];
}

// ── Export ──────────────────────────────────────────────────

export async function exportData(): Promise<void> {
    const payload: ExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        foods: db.select().from(foods).all(),
        entries: db.select().from(entries).all(),
        goals: db.select().from(goals).all(),
        recipes: db.select().from(recipes).all(),
        recipeItems: db.select().from(recipeItems).all(),
        recipeLogs: db.select().from(recipeLogs).all(),
        weightLogs: db.select().from(weightLogs).all(),
        servingUnits: db.select().from(servingUnits).all(),
        notificationSettings: db.select().from(notificationSettings).all(),
        chatSessions: db.select().from(chatSessions).all(),
        chatMessages: db.select().from(chatMessages).all(),
        aiMemories: db.select().from(aiMemories).all(),
        exerciseTemplates: db.select().from(exerciseTemplates).all(),
        workouts: db.select().from(workouts).all(),
        workoutExercises: db.select().from(workoutExercises).all(),
        exerciseSets: db.select().from(exerciseSets).all(),
    };

    const json = JSON.stringify(payload, null, 2);
    const file = new File(Paths.cache, "macroflow-backup.json");
    file.write(json);
    await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Export MacroFlow Data",
        UTI: "public.json",
    });
}

// ── Import ─────────────────────────────────────────────────

export async function importData(): Promise<{ inserted: number }> {
    const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) {
        throw new Error("cancelled");
    }

    const uri = result.assets[0].uri;
    const pickedFile = new File(uri);
    const raw = await pickedFile.text();

    const data: ExportPayload = JSON.parse(raw);
    validate(data);

    let inserted = 0;

    // Wrap everything in a transaction so partial imports don't corrupt the DB
    db.transaction((tx) => {
        // Clear existing data (order matters for FK constraints — children first)
        tx.delete(exerciseSets).run();
        tx.delete(workoutExercises).run();
        tx.delete(workouts).run();
        tx.delete(exerciseTemplates).run();
        tx.delete(chatMessages).run();
        tx.delete(chatSessions).run();
        tx.delete(aiMemories).run();
        tx.delete(entries).run();
        tx.delete(recipeLogs).run();
        tx.delete(recipeItems).run();
        tx.delete(recipes).run();
        tx.delete(servingUnits).run();
        tx.delete(foods).run();
        tx.delete(weightLogs).run();
        tx.delete(notificationSettings).run();

        for (const row of data.foods) {
            tx.insert(foods).values(row).run();
            inserted++;
        }
        if (data.servingUnits) {
            for (const row of data.servingUnits) {
                tx.insert(servingUnits).values(row).run();
                inserted++;
            }
        }
        for (const row of data.recipes) {
            tx.insert(recipes).values(row).run();
            inserted++;
        }
        for (const row of data.recipeItems) {
            tx.insert(recipeItems).values(row).run();
            inserted++;
        }
        if (data.recipeLogs) {
            for (const row of data.recipeLogs) {
                tx.insert(recipeLogs).values(row).run();
                inserted++;
            }
        }
        for (const row of data.entries) {
            tx.insert(entries).values(row).run();
            inserted++;
        }
        if (data.weightLogs) {
            for (const row of data.weightLogs) {
                tx.insert(weightLogs).values(row).run();
                inserted++;
            }
        }
        if (data.goals.length > 0) {
            tx.delete(goals).run();
            for (const row of data.goals) {
                tx.insert(goals).values(row).run();
            }
            inserted++;
        }
        if (data.notificationSettings) {
            for (const row of data.notificationSettings) {
                tx.insert(notificationSettings).values(row).run();
                inserted++;
            }
        }
        if (data.aiMemories) {
            for (const row of data.aiMemories) {
                tx.insert(aiMemories).values(row).run();
                inserted++;
            }
        }
        if (data.chatSessions) {
            for (const row of data.chatSessions) {
                tx.insert(chatSessions).values(row).run();
                inserted++;
            }
        }
        if (data.chatMessages) {
            for (const row of data.chatMessages) {
                tx.insert(chatMessages).values(row).run();
                inserted++;
            }
        }
        if (data.exerciseTemplates) {
            for (const row of data.exerciseTemplates) {
                tx.insert(exerciseTemplates).values(row).run();
                inserted++;
            }
        }
        if (data.workouts) {
            for (const row of data.workouts) {
                tx.insert(workouts).values(row).run();
                inserted++;
            }
        }
        if (data.workoutExercises) {
            for (const row of data.workoutExercises) {
                tx.insert(workoutExercises).values(row).run();
                inserted++;
            }
        }
        if (data.exerciseSets) {
            for (const row of data.exerciseSets) {
                tx.insert(exerciseSets).values(row).run();
                inserted++;
            }
        }
    });

    return { inserted };
}

// ── Validation ─────────────────────────────────────────────

function validate(data: unknown): asserts data is ExportPayload {
    if (data == null || typeof data !== "object") {
        throw new Error("Invalid backup file: not a JSON object.");
    }
    const d = data as Record<string, unknown>;
    if (d.version !== 1) {
        throw new Error("Unsupported backup version.");
    }
    for (const key of ["foods", "entries", "goals", "recipes", "recipeItems"]) {
        if (!Array.isArray(d[key])) {
            throw new Error(`Invalid backup file: missing "${key}" array.`);
        }
    }
    // recipeLogs is optional for backwards compat with older exports
    if (d.recipeLogs !== undefined && !Array.isArray(d.recipeLogs)) {
        throw new Error(`Invalid backup file: "recipeLogs" must be an array.`);
    }
    if (d.weightLogs !== undefined && !Array.isArray(d.weightLogs)) {
        throw new Error(`Invalid backup file: "weightLogs" must be an array.`);
    }
    if (d.servingUnits !== undefined && !Array.isArray(d.servingUnits)) {
        throw new Error(`Invalid backup file: "servingUnits" must be an array.`);
    }
    if (d.notificationSettings !== undefined && !Array.isArray(d.notificationSettings)) {
        throw new Error(`Invalid backup file: "notificationSettings" must be an array.`);
    }
    if (d.chatSessions !== undefined && !Array.isArray(d.chatSessions)) {
        throw new Error(`Invalid backup file: "chatSessions" must be an array.`);
    }
    if (d.chatMessages !== undefined && !Array.isArray(d.chatMessages)) {
        throw new Error(`Invalid backup file: "chatMessages" must be an array.`);
    }
    if (d.aiMemories !== undefined && !Array.isArray(d.aiMemories)) {
        throw new Error(`Invalid backup file: "aiMemories" must be an array.`);
    }
    if (d.exerciseTemplates !== undefined && !Array.isArray(d.exerciseTemplates)) {
        throw new Error(`Invalid backup file: "exerciseTemplates" must be an array.`);
    }
    if (d.workouts !== undefined && !Array.isArray(d.workouts)) {
        throw new Error(`Invalid backup file: "workouts" must be an array.`);
    }
    if (d.workoutExercises !== undefined && !Array.isArray(d.workoutExercises)) {
        throw new Error(`Invalid backup file: "workoutExercises" must be an array.`);
    }
    if (d.exerciseSets !== undefined && !Array.isArray(d.exerciseSets)) {
        throw new Error(`Invalid backup file: "exerciseSets" must be an array.`);
    }
}
