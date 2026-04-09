# Code Guidelines
## Architecture Overview

```
[ Route (app/) ]          # thin re-export layer
       ↓
[ Screen ]                # orchestrates feature UI, holds page-level state
       ↓
[ Components / Hooks ]    # UI building blocks + logic extraction
       ↓
[ Services ]              # DB queries, API calls, business logic
       ↓
[ SQLite via Drizzle ]    # persistence
```

**Key principles:**

- **Feature-first** organisation — every domain lives in its own folder under `src/features/`.
- **Subdivide by role** — each feature splits into `screens/`, `components/`, `hooks/`, `services/`, `helpers/`, `types.ts`.
- **Shared code** lives in `src/shared/` (atoms, components, providers, store, types).
- **Route files are thin** — one-liner re-exports from the matching feature screen.
- **Colocate by default, promote when reused** — start in the feature folder; move to `shared/` only when a second feature needs it.

---

## Folder Structure

```
app/                                    # Expo Router file-based routes (thin re-exports only)
├─ <see §3 Routes>

assets/
├─ images/                              # app icons, splash, static images
├─ fonts/                               # custom fonts (if any)

scripts/

src/
├─ shared/                              # code used by 2+ features
│  ├─ atoms/                            # tiny styled primitives (Button, Input, ModalHeader)
│  ├─ components/                       # larger reusable UI (BottomSheet, CalendarPicker, MacroLabel, UnitPicker)
│  ├─ providers/                        # React context providers
│  ├─ store/                            # Zustand stores shared across features
│  └─ types.ts                          # shared type definitions (MealType, FoodSource, AppearanceMode, etc.)
│
├─ features/                            # one sub-folder per product domain
│  ├─ <feature>/
│  │  ├─ screens/                       # orchestrating top level page component
│  │  ├─ components/                    # components being used in screens; components can reference smaller components
│  │  ├─ hooks/                         # data retrievel and other hooks
│  │  ├─ services/                      # feature-specific services; often includes a <feature>Db service
│  │  ├─ helpers/                       # internal helpers used only inside this feature
│  │  └─ types.ts                       # EntryWithFood, RecipeGroup, etc.
│
├─ services/                            # app-wide services that don't belong to one feature
│
├─ i18n/
│  ├─ index.ts                          # i18next initialisation
│  └─ locales/
│     ├─ en.ts
│     └─ de.ts
│
└─ utils/                               # pure utilities, no business logic
```

### Guiding Rules

| Rule                                                               | Rationale                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A feature **never imports from another feature's UI**              | Keeps features independent. If two features need the same code, promote it to `shared/` or `services/`.                                     |
| `shared/atoms/` are **tiny wrappers** only                         | If a component has its own state or >80 lines, it belongs in `shared/components/` or a feature.                                             |
| `services/db/` holds **only** connection + schema                  | All query functions live in the feature that owns the data (e.g., `features/log/services/logDb.ts`).                                        |
| Sub-folders (`components/`, `hooks/`, …) are **created on demand** | Don't add empty folders. A feature with one screen and no extracted hooks needs only `screens/`.                                            |
| One exported component per file                                    | Tiny internal helpers inside the same file are fine.                                                                                        |
| Cross-feature **service** imports are fine                         | Feature A can call feature B's service functions (e.g., `log` calling `templateDb.getFoodById`). Only UI layer cross-imports are forbidden. |

---

## Routes

Route files live in `app/` and must be **thin re-exports**. No business logic, no hooks, no JSX beyond what Expo Router requires for layouts.

```
app/
├─ _layout.tsx                          # root layout: fonts, providers, splash
├─ index.tsx                            # redirect → /(tabs)
├─ db-test.tsx                          # debug-only screen (remove before 1.0)
├─ (tabs)/
│  ├─ _layout.tsx                       # bottom-tab navigator + header
│  ├─ index.tsx                         # → LogScreen
│  ├─ templates.tsx                     # → TemplatesScreen
│  ├─ analytics.tsx                     # → AnalyticsScreen
│  ├─ meal-plan.tsx                     # → MealPlanScreen
│  ├─ more.tsx                          # → MoreScreen
│  ├─ settings.tsx                      # → SettingsScreen
│  ├─ goals.tsx                         # → GoalsScreen
│  ├─ backup.tsx                        # → BackupScreen
│  └─ ai-settings.tsx                   # → AiSettingsScreen
├─ log/
│  ├─ _layout.tsx                       # stack for log sub-screens
│  └─ add.tsx                           # → AddFoodScreen
└─ templates/
   ├─ _layout.tsx                       # stack for template sub-screens
   ├─ edit.tsx                          # → RecipeEditorScreen
   └─ food-edit.tsx                     # → FoodEditorScreen
```

**Route file pattern** (every file except `_layout.tsx` looks like this):

```tsx
export { default } from "@/src/features/<feature>/screens/<ScreenName>";
```

---


## File & Folder Rules

### When to create sub-folders

| Condition                                 | Action                                        |
| ----------------------------------------- | --------------------------------------------- |
| Feature has a screen                      | create `screens/`                             |
| Feature has a non-screen component        | create `components/`                          |
| Feature has a custom hook                 | create `hooks/`                               |
| Feature has a DB query or API call        | create `services/`                            |
| Feature has a pure helper function        | create `helpers/`                             |
| Feature has a non-trivial type definition | create `types.ts` (single file, not a folder) |

A feature with just one screen and nothing extracted can be a single file: `features/more/screens/MoreScreen.tsx`.

### Barrel exports

**Don't use index.ts barrel files inside features.** Import directly from the file. Barrels hide circular dependencies and slow auto-imports.

Exception: `src/services/db/index.ts` (DB connection) and `src/i18n/index.ts` (i18next init) are fine because they're true module entry-points.

---

## Naming Conventions

### Files & folders

| Kind                       | Convention                            | Example                                                      |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Screen component           | `PascalCase` + `Screen` suffix        | `LogScreen.tsx`                                              |
| Component                  | `PascalCase`                          | `MealSection.tsx`, `ChatBubble.tsx`                          |
| Hook                       | `camelCase` with `use` prefix         | `useLogEntries.ts`                                           |
| Service / DB module        | `camelCase`                           | `logDb.ts`, `nvidia.ts`                                      |
| Helper / utility           | `camelCase`                           | `weightTrend.ts`, `date.ts`                                  |
| Types file                 | `types.ts` (always this name)         | `features/log/types.ts`                                      |
| Feature folder             | `kebab-case` (match route naming)     | `features/log/`, `features/ai/`                              |
| Sub-folders inside feature | `lowercase` singular                  | `screens/`, `components/`, `hooks/`, `services/`, `helpers/` |
| Route files                | `kebab-case` (Expo Router convention) | `ai-settings.tsx`, `food-edit.tsx`                           |
| Shared atoms               | `PascalCase`                          | `Button.tsx`, `Input.tsx`                                    |

### Symbols (TypeScript)

| Kind               | Convention                     | Example                                      |
| ------------------ | ------------------------------ | -------------------------------------------- |
| Component / Screen | `PascalCase` function          | `export default function LogScreen()`        |
| Hook               | `camelCase` with `use` prefix  | `export function useLogEntries()`            |
| Helper function    | `camelCase`                    | `export function computeWeightTrend()`       |
| Type / Interface   | `PascalCase`                   | `type EntryWithFood`, `interface ChatConfig` |
| Enum-like constant | `UPPER_SNAKE_CASE`             | `MEAL_TYPES`, `CHAT_BAR_TOTAL_HEIGHT`        |
| Other constants    | `camelCase`                    | `const defaultGoals = …`                     |
| Boolean variables  | `is` / `has` / `should` prefix | `isLoading`, `hasSearched`, `shouldRefresh`  |
| Event handlers     | `handle` prefix                | `handlePress`, `handleSave`                  |
| Callback props     | `on` prefix                    | `onPress`, `onSave`, `onDismiss`             |

### Exports

- **Screens**: always `export default function` (Expo Router expects default exports).
- **Everything else**: prefer **named exports**. Makes refactoring and tree-shaking easier.
- One public export per file. Small internal helpers within the same file are fine, but consider moving them into helpers.

---

## Component Guidelines

### Functional components only

No class components. Use `function` declarations (not arrow-function assignments) for components:

```tsx
// ✅
export default function LogScreen() { … }

// ❌
const LogScreen = () => { … };
export default LogScreen;
```

### Props

- Destructure props in the parameter list.
- Define prop types with `interface` directly above the component (or import from `types.ts` if shared).
- Don't use `React.FC` — it adds an implicit `children` and provides no benefit.

```tsx
interface MealSectionProps {
  mealType: MealType;
  entries: Entry[];
  onEntryPress: (entry: Entry) => void;
}

export default function MealSection({ mealType, entries, onEntryPress }: MealSectionProps) { … }
```

### Hooks

- Extract stateful logic into custom hooks (except tiny hooks < 10 lines).
- Hooks go in the feature's `hooks/` folder.
- A hook file exports **one** hook and optionally its return type.

### Memoization

- Use `React.useMemo` / `React.useCallback` for expensive computations and callbacks passed to child components.
- Use `React.memo()` on list-item components rendered inside `FlatList` / `ScrollView`.
- Don't prematurely memo everything — only when there's a measured or obvious perf benefit.

---

## State Management

| Scope                                                           | Tool                      | Example                                        |
| --------------------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| **Local UI** (form inputs, modals, loading flags)               | `useState` / `useReducer` | `const [query, setQuery] = useState("")`       |
| **Derived per-screen** (fetched data, computed values)          | custom hook               | `useLogEntries(date)` returns entries + totals |
| **Global cross-feature** (selected date, unit system, language) | Zustand (`useAppStore`)   | `useAppStore(s => s.selectedDate)`             |

Rules:
- Zustand store stays **small**. Only put data here that multiple features read.
- No DB calls inside Zustand actions — the store holds UI state, services handle persistence.
- Prefer deriving values over storing duplicates.

---

## Database & Services

### Schema (`src/services/db/schema.ts`)

- Single file with all Drizzle table definitions.
- Keep it declarative — no runtime logic.

### DB connection (`src/services/db/index.ts`)

- Exports `db` instance and migration runner.
- No query functions here.

### Feature DB services

Each feature owns its data through a service file. Pattern:

```tsx
// features/log/services/logDb.ts
import { db } from "@/src/services/db";
import { entries } from "@/src/services/db/schema";

export function getEntriesByDate(date: string) {
  return db.select().from(entries).where(eq(entries.date, date)).all();
}
```

### Cross-feature data access

When feature A needs data owned by feature B (e.g., `log` needs to look up a `food` from `templates`), it imports from the owning feature's service:

```tsx
import { getFoodById } from "@/src/features/templates/services/templateDb";
```

This is acceptable. The import boundary rule applies to **UI components / hooks / screens**, not to services. Service-level cross-imports are fine because they're just function calls with no React coupling.

### App-wide services (`src/services/`)

- `notifications.ts` — push-notification scheduling (used by `log` + `settings`).
- `openfoodfacts.ts` — OpenFoodFacts API (used by `log` + `templates`).

These stay at the top level because they serve multiple features equally.

---

## Styling

### StyleSheet

- Use `StyleSheet.create()` at the **bottom** of each component file.
- For theme-aware styles, use a factory function: `const createStyles = (colors: ThemeColors) => StyleSheet.create({ … })`.
- Memoise inside the component: `const styles = useMemo(() => createStyles(colors), [colors])`.

### Tokens

All design tokens come from `src/utils/theme.ts`:

- `spacing` — `xs`, `sm`, `md`, `lg`, `xl`
- `fontSize` — `sm`, `md`, `lg`, `xl`
- `borderRadius` — `sm`, `md`, `lg`, `full`
- `lightColors` / `darkColors` — semantic colour palette

Never hard-code colours or spacing values. Always reference tokens.

### Icons

Use `@expo/vector-icons` (Ionicons). Keep icon names as constants when referenced in multiple places.

---

## Imports

### Order

Group imports in this order, separated by blank lines:

1. React / React Native
2. Expo / third-party libraries
3. `@/src/shared/` (atoms, components, providers, store, types)
4. `@/src/services/` and `@/src/utils/`
5. Relative feature imports (`./`, `../`)

### Path aliases

Use the `@/` alias for all non-relative imports:

```tsx
import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
```

Use **relative imports** only within the same feature:

```tsx
// inside features/log/screens/LogScreen.tsx
import MealSection from "../components/MealSection";
import { useLogEntries } from "../hooks/useLogEntries";
```

---

## Internationalisation (i18n)

- All user-visible strings go through `t()` from `react-i18next`.
- Translation keys use dot-notation: `settings.appearance`, `log.addFood.title`.
- Key naming: `<feature>.<screen-or-context>.<element>`.
- New features must add keys to **both** `en.ts` and `de.ts` before merging.

---

## File Size Limits

| Threshold       | Action                                                 |
| --------------- | ------------------------------------------------------ |
| **> 150 lines** | Check if hooks or helpers can be extracted             |
| **> 250 lines** | Extract reusable chunks into `components/` or `hooks/` |
| **> 400 lines** | Must be split — no exceptions for new code             |

These limits apply to all `.tsx` / `.ts` files. Locale files (`en.ts`, `de.ts`) and auto-generated code are exempt.
