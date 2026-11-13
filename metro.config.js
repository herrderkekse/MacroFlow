const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    "expo-keep-awake": path.resolve(__dirname, "src/shims/expoKeepAwake.ts"),
};

// --- Web (screen gallery, `npm run gallery`, see scripts/gallery-server.js) ---
// The app is native-first; the web build exists only so every screen can be
// viewed side by side for design review. Native builds resolve as before.

// expo-sqlite's web worker ships a .wasm build of SQLite.
config.resolver.assetExts.push("wasm");

// Native modules without (complete) web implementations → web-only shims.
const WEB_SHIMS = {
    "expo-secure-store": "src/shims/web/expoSecureStore.ts",
    "expo-file-system": "src/shims/web/expoFileSystem.ts",
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === "web" && WEB_SHIMS[moduleName]) {
        return { type: "sourceFile", filePath: path.resolve(__dirname, WEB_SHIMS[moduleName]) };
    }
    // expo-sqlite's worker truncates sync results over 255 bytes; see the shim.
    // (Matched by directory: Metro caches resolutions per directory, so a
    // condition on the importing file would leak to its neighbours.)
    if (platform === "web" && moduleName === "./WorkerChannel"
        && context.originModulePath.includes(path.join("expo-sqlite", "web") + path.sep)) {
        return { type: "sourceFile", filePath: path.resolve(__dirname, "src/shims/web/expoSqliteWorkerChannel.js") };
    }
    // Every SQLite database in memory instead of OPFS; see the shim.
    if (platform === "web" && moduleName === "./wa-sqlite/AccessHandlePoolVFS"
        && context.originModulePath.includes(path.join("expo-sqlite", "web") + path.sep)) {
        return { type: "sourceFile", filePath: path.resolve(__dirname, "src/shims/web/expoSqliteMemoryVfs.js") };
    }
    // The shims import expo-sqlite internals (incl. the originals they wrap)
    // that its package.json doesn't export.
    if (platform === "web" && moduleName.startsWith("expo-sqlite/web/")) {
        const pkgDir = path.dirname(require.resolve("expo-sqlite/package.json"));
        const base = path.join(pkgDir, moduleName.slice("expo-sqlite/".length));
        return { type: "sourceFile", filePath: fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.js` };
    }
    return defaultResolveRequest
        ? defaultResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
