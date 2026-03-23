import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { db } from "@/src/db";
import { foods, entries, goals, recipes, recipeItems } from "@/src/db/schema";

// ── Types ──────────────────────────────────────────────────

interface ExportPayload {
    version: 1;
    exportedAt: string;
    foods: (typeof foods.$inferSelect)[];
    entries: (typeof entries.$inferSelect)[];
    goals: (typeof goals.$inferSelect)[];
    recipes: (typeof recipes.$inferSelect)[];
    recipeItems: (typeof recipeItems.$inferSelect)[];
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
        // Clear existing data (order matters for FK constraints)
        tx.delete(recipeItems).run();
        tx.delete(entries).run();
        tx.delete(recipes).run();
        tx.delete(foods).run();

        for (const row of data.foods) {
            tx.insert(foods).values(row).run();
            inserted++;
        }
        for (const row of data.recipes) {
            tx.insert(recipes).values(row).run();
            inserted++;
        }
        for (const row of data.recipeItems) {
            tx.insert(recipeItems).values(row).run();
            inserted++;
        }
        for (const row of data.entries) {
            tx.insert(entries).values(row).run();
            inserted++;
        }
        if (data.goals.length > 0) {
            tx.delete(goals).run();
            for (const row of data.goals) {
                tx.insert(goals).values(row).run();
            }
            inserted++;
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
}
