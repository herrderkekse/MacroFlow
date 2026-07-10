# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MacroFlow is a nutrition (and, in progress, exercise) logging app built with Expo, React Native, and Expo Router. Local-first: all data lives in SQLite on-device (via `expo-sqlite` + Drizzle), no backend/API server. Barcode lookups go through the OpenFoodFacts API; an optional AI coach feature talks to an OpenAI-compatible endpoint via the `ai` SDK.

## Commands

```bash
npm run start           # expo start (dev server, scan QR or press a/i/w)
npm run android         # expo run:android (native build + install)
npm run ios             # expo run:ios
npm run web             # expo start --web (not actively supported)
npm run lint            # expo lint (ESLint, flat config)
npm run reset-project   # scripts/reset-project.js — resets example assets
npm run gen-assets      # scripts/generate-images.js
```

There is no test suite/runner configured in this repo. `npm run lint` is the only automated check — run it before finishing a change (`--fix` should not be assumed to be non-destructive; review its diff).

To type-check without emitting: `npx tsc --noEmit`.

## Architecture

Layered, feature-first structure, enforced by `eslint-plugin-boundaries` in [eslint.config.js](eslint.config.js):

```
app/ (route, thin re-export)
  → src/features/<feature>/screens
    → components/ hooks/  (same-feature UI only)
      → services/  (feature owns its data; cross-feature service imports ARE allowed)
        → src/services/db  (Drizzle schema + connection only, no queries)
```

Full conventions (naming, file-size limits, styling, i18n, import order) are documented in [CONTRIBUTING.md](CONTRIBUTING.md) — read it before making structural changes. The load-bearing rules:

- **Route files** (`app/**/*.tsx`, except `_layout.tsx`) are one-line re-exports: `export { default } from "@/src/features/<feature>/screens/<Screen>";`. No logic lives there.
- **A feature's UI (screens/components/hooks) never imports another feature's UI.** Shared UI goes in `src/shared/`; cross-feature *services* are fine (e.g. `log` calling `templateDb.getFoodById`) since they're plain function calls with no React coupling.
- **No barrel `index.ts` files** inside features (hides circular deps, slows auto-imports). Exceptions: `src/services/db/index.ts` and `src/i18n/index.ts` are true entry points.
- Sub-folders (`components/`, `hooks/`, `services/`, `helpers/`) are created on demand, not scaffolded speculatively.
- File-size discipline: >150 lines, consider extracting hooks/helpers; >250, extract into `components/`/`hooks/`; >400 must be split.

### Database

- `src/services/db/schema.ts` — single file with all Drizzle table definitions (declarative only).
- `src/services/db/index.ts` — owns the `db` connection and `initDB()`. **There is no Drizzle migration generator in use.** Schema evolves by hand: `initDB()` runs `CREATE TABLE IF NOT EXISTS` for the base schema, then a list of `ALTER TABLE ... ADD COLUMN` strings (each wrapped in try/catch to no-op if the column already exists), then any one-off data backfills. When changing the schema, update `schema.ts` **and** append a matching `ALTER TABLE` statement (plus backfill logic if needed) to the migrations list in `index.ts` — don't rewrite/remove earlier entries, since they must stay replayable against existing installs.
- Query functions live in the owning feature, e.g. `src/features/log/services/logDb.ts` (pattern: `<feature>Db.ts`), not in `src/services/db/`.

### State management

- Local UI state → `useState`/`useReducer`.
- Per-screen derived/fetched data → a custom hook in the feature's `hooks/`.
- Global cross-feature state (selected date, unit system, appearance, language) → the single Zustand store at `src/shared/store/useAppStore.ts`. Keep it small; it holds UI state only, never DB calls in actions — services handle persistence.

### Styling & i18n

- Theme tokens (`spacing`, `fontSize`, `borderRadius`, `lightColors`/`darkColors`) come from `src/utils/theme.ts` — never hard-code colors/spacing.
- Theme-aware components use a `createStyles(colors)` factory memoized via `useThemeColors()` from `src/shared/providers/ThemeProvider`.
- All user-visible strings go through `t()` (react-i18next). Keys are `<feature>.<screen-or-context>.<element>`. Adding a key requires updating **both** `src/i18n/locales/en.ts` and `de.ts`.

### AI feature

`src/features/ai/` implements a chat-based coach using the `ai` SDK against an OpenAI-compatible endpoint (`@ai-sdk/openai-compatible`), with tool definitions in `src/features/ai/constants/toolDefinitions` and executors in `src/features/ai/services/toolExecutors` — these are the hooks an AI tool call uses to mutate app data, so new mutations intended to be AI-callable should be added there rather than only wired into a screen.

## Workflow conventions

- Work is tracked via GitHub issues; branches are named `<issueId>-short-description`.
- Commits/PRs reference the issue (`closes`/`resolves`).
- PRs get at least one label (`bug`, `feature request`, `enhancement`, `refactor`, `documentation`).

## Releasing

Release process (versioning, branch/tag naming, EAS build profiles, local signed-APK builds via `scripts/create-release-apk.sh`) is documented in [RELEASING.md](RELEASING.md) — consult it before touching `app.json`/`package.json` version fields or `eas.json`.
