// Web entry: the screen gallery (see gallery/README.md). Native uses index.js.
//
// 1. Warm up expo-sqlite's worker. The app opens SQLite synchronously at
//    module load, and on web a sync call only busy-waits briefly for the
//    worker, so the very first one times out while the .wasm is still loading.
// 2. Create this frame's in-memory database and fill it with sample data.
// 3. Apply per-frame overrides from the URL (?theme=light|dark, ?lang=en|de)
//    to the settings row, which the app then reads on start like any other.
// 4. Load the app, without the dev error toasts (they'd cover every frame's
//    tab bar; warnings still go to the console).
import { openDatabaseAsync } from "expo-sqlite";

try {
    // Expo's own LogBox on web (not react-native's); a transitive dependency,
    // so failing here only means the toasts stay.
    require("@expo/log-box/src/LogBox").default.ignoreAllLogs();
} catch { /* keep the toasts */ }

openDatabaseAsync(":memory:")
    .then((warmup) => warmup.closeAsync())
    .then(async () => {
        const { expoDb, initDB } = require("@/src/services/db");
        const { seedSampleData } = require("@/gallery/sampleData");
        initDB();
        await seedSampleData();

        const params = new URLSearchParams(window.location.search);
        const theme = params.get("theme");
        const lang = params.get("lang");
        if (theme === "light" || theme === "dark") {
            expoDb.runSync("UPDATE goals SET appearance_mode = ? WHERE id = 1", [theme]);
        }
        if (lang === "en" || lang === "de") {
            expoDb.runSync("UPDATE goals SET language = ? WHERE id = 1", [lang]);
        }
    })
    .catch((error) => console.error("[gallery] setup failed", error))
    .finally(() => {
        require("expo-router/entry");
    });
