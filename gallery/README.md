# Screen gallery

Every screen of the app side by side in the browser, for design review: spotting
inconsistent spacing, type, controls and copy across screens.

```bash
npm run gallery            # then open http://localhost:8090/gallery
npm run gallery -- --clear # same, with Metro's cache cleared (see Troubleshooting)
```

The header switches theme (light, dark, both side by side), language and frame
size. Below it, the screen picker chooses which screens to show (**All** /
**None** to reset): with all of them the page is grouped by area, with a subset
they sit in one row, so any two screens can be compared side by side. Each frame is the real app, running on the web build, so you can click
around in it. Edits to app code show after **Reload all**. A route's path above
its frame opens it full size in a new tab.

It is a design tool, not a supported web version of the app. React Native Web
renders fonts, shadows and press feedback a little differently from Android, so
check anything that looks off at that level on a device.

## How it works

| File | Role |
| --- | --- |
| `gallery/server.js` | Starts `expo start --web` on port 8091 and puts a proxy on 8090 in front of it. The proxy adds the cross-origin-isolation headers expo-sqlite needs on web (`SharedArrayBuffer`) and serves this folder's `index.html` at `/gallery`. |
| `gallery/index.html` | The gallery page. **The list of screens lives here** (`SECTIONS`); add new routes to it. |
| `gallery/sampleData.ts` | Made-up data seeded into every frame. Ids are assigned in insertion order, which is what the `?recipeId=…`-style links in `index.html` rely on. |
| `index.web.js` | Web entry point. Seeds the frame's database, applies `?theme=` / `?lang=` to the settings row, then loads the app. Native uses `index.js`. |
| `src/shims/web/*` | Web-only stand-ins, wired up in `metro.config.js`: secure store → `localStorage`, file system → no-op (Backup lists two made-up backups), and two fixes to expo-sqlite's web worker (see below). |
| `src/services/keepAwake.web.ts` | No-op keep-awake, picked up by Metro's `.web.ts` platform extension. |

Every frame has its own **in-memory** database, so nothing is shared between
frames or kept across reloads, and your device data is never touched.

### expo-sqlite on web

Four things in expo-sqlite (57.0.5) needed working around; all of them are
web-only, so native builds are unaffected:

- **The first sync call times out** while the worker is still loading its
  `.wasm`. `index.web.js` warms the worker up with one async call first.
- **Sync results over 255 bytes arrive truncated**: the worker writes the
  result length into a byte array element-wise. Fixed in
  `src/shims/web/expoSqliteWorkerChannel.js`, which also waits for sync calls by
  wall-clock time instead of a fixed spin count, and reuses its buffers instead
  of allocating 1 MB per call.
- **Only one tab or frame can run SQLite at a time**, because the persistent
  storage locks its files in OPFS. `src/shims/web/expoSqliteMemoryVfs.js`
  swaps it for in-memory storage.
- **Sync calls allocate shared memory**, so seeding uses async inserts.

## Troubleshooting

- **A frame shows "Unterminated string in JSON" or an empty, unthemed app.**
  Metro cached a module resolution from before a `metro.config.js` change.
  Restart with `npm run gallery -- --clear`.
- **Frames stay blank.** They load as you scroll, three at a time. Each frame is
  a whole app instance, so "both" themes doubles the memory used.
- **A new screen crashes on web.** It probably uses a native module with no web
  implementation. Add a stand-in to `WEB_SHIMS` in `metro.config.js`, or a
  `.web.ts` file next to the module that uses it.
