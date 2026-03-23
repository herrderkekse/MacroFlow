# MacroFlow

MacroFlow is a nutrition logging app built with Expo, React Native, and Expo Router. It provides lightweight food logging, recipe creation, barcode lookup (OpenFoodFacts), and import/export backup utilities.

## Features

- Log food entries with per-food units and serving sizes
- Create and edit recipes and log them as grouped entries
- Barcode lookup via OpenFoodFacts integration
- Import / Export JSON backups
- Simple tabbed UI using Expo Router

## Tech Stack

- React Native (Expo)
- Expo Router
- SQLite (via expo-sqlite) for local storage
- TypeScript
- Zustand for lightweight state

## Requirements

- Node.js (>=16)
- npm or yarn
- Expo CLI (optional: using `npx expo` avoids global install)

## Getting Started

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd MacroFlow
npm install
```

Run the app (Expo):

```bash
npx expo start
# or
npm run start
```

Platform-specific:

```bash
npm run android    # open on Android emulator/device
npm run ios        # open on iOS simulator/device
npm run web        # run web build (not actively supported)
```

Other useful scripts:

- `npm run reset-project` — resets project assets (script at `scripts/reset-project.js`)
- `npm run lint` — runs ESLint

## Project Structure (high level)

- `app/` — Expo Router entrypoints and screens
- `src/` — main source code
  - `features/` — feature-based screens and components (log, recipes, settings)
  - `db/` — database schema and queries
  - `services/` — external integrations (OpenFoodFacts, import/export)
  - `store/` — app state hooks
  - `utils/` — helpers and theme utilities

## Credits & Licensing

- OpenFoodFacts: This project uses food product data and images from OpenFoodFacts. The OpenFoodFacts database is made available under the Open Database License (ODbL) v1.0. When using data or images from OpenFoodFacts, please acknowledge the source. Suggested attribution text:

   "Contains data from OpenFoodFacts (https://openfoodfacts.org) made available under the Open Database License (ODbL) v1.0."

   More information:

   - OpenFoodFacts: https://openfoodfacts.org
   - ODbL v1.0 license: https://opendatacommons.org/licenses/odbl/1.0/

- Third-party libraries and tools: see `package.json` for dependency list and their individual licenses.

## License

This project is released under the terms of the repository license. See the `LICENSE` file in the project root.
