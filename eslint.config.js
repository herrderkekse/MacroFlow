// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'app-example/**'],
  },
  // ─── Architecture boundary rules ───────────────────────────────────────────
  // Enforces the layered architecture defined in CONTRIBUTING.md:
  //   route → feature-screen → feature-{component,hook,service,helper,types}
  //                          → shared / app-service / util / i18n
  //
  // Key constraints:
  //   • Route files (non-layout)  → only re-export from feature screens
  //   • Feature UI layers         → only import same-feature UI; any feature's services are fine
  //   • Feature services          → may cross-import other features' services (no UI)
  //   • shared / util / i18n      → used everywhere, import nothing from features
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // Layout files must come before `route` so they get their own, more
        // permissive element type rather than falling into the `route` bucket.
        {
          type: 'layout',
          pattern: 'app/**/_layout.tsx',
          mode: 'full',
        },
        // Non-layout route files: must be thin re-exports from a feature screen.
        {
          type: 'route',
          pattern: 'app/**/*.tsx',
          mode: 'full',
        },

        // ── Feature UI layers (capture the feature name from the path) ────────
        {
          type: 'feature-screen',
          pattern: 'src/features/*/screens/**',
          mode: 'full',
          capture: ['featureName'],
        },
        {
          type: 'feature-component',
          pattern: 'src/features/*/components/**',
          mode: 'full',
          capture: ['featureName'],
        },
        {
          type: 'feature-hook',
          pattern: 'src/features/*/hooks/**',
          mode: 'full',
          capture: ['featureName'],
        },
        // Feature services: cross-feature imports are explicitly allowed
        {
          type: 'feature-service',
          pattern: 'src/features/*/services/**',
          mode: 'full',
          capture: ['featureName'],
        },
        // Feature helpers: same-feature imports only
        {
          type: 'feature-helper',
          pattern: 'src/features/*/helpers/**',
          mode: 'full',
          capture: ['featureName'],
        },
        // Feature types file (single file per feature)
        {
          type: 'feature-types',
          pattern: 'src/features/*/types.ts',
          mode: 'full',
          capture: ['featureName'],
        },

        // ── Cross-cutting infrastructure ─────────────────────────────────────
        // Shared code used by 2+ features (atoms, components, providers, store)
        { type: 'shared', pattern: 'src/shared/**', mode: 'full' },
        // App-wide services (DB connection, notifications, OpenFoodFacts)
        { type: 'app-service', pattern: 'src/services/**', mode: 'full' },
        // Pure, side-effect-free utilities
        { type: 'util', pattern: 'src/utils/**', mode: 'full' },
        // i18n initialisation and locale files
        { type: 'i18n', pattern: 'src/i18n/**', mode: 'full' },
      ],
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        rules: [
          // Layout files (_layout.tsx): bootstrap-level, may access feature
          // services (to initialise app state) plus shared infrastructure.
          {
            from: { type: 'layout' },
            allow: { to: { type: ['feature-service', 'shared', 'app-service', 'util', 'i18n'] } },
          },

          // Route files: thin re-exports – the ONLY allowed import is the
          // matching feature screen. No other internal imports permitted.
          {
            from: { type: 'route' },
            allow: { to: { type: 'feature-screen' } },
          },

          // Feature screens: orchestrate the page; may reach into all
          // same-feature layers, plus any feature's services.
          {
            from: { type: 'feature-screen' },
            allow: {
              to: [
                { type: 'feature-screen', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-component', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-hook', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-service' },   // any feature's services are fine
                { type: 'feature-helper', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-types', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'shared' },
                { type: 'app-service' },
                { type: 'util' },
                { type: 'i18n' },
              ],
            },
          },

          // Feature components: same rules as screens (no cross-feature UI).
          {
            from: { type: 'feature-component' },
            allow: {
              to: [
                { type: 'feature-component', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-hook', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-service' },
                { type: 'feature-helper', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-types', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'shared' },
                { type: 'app-service' },
                { type: 'util' },
                { type: 'i18n' },
              ],
            },
          },

          // Feature hooks: same-feature data/logic layers + any feature service.
          {
            from: { type: 'feature-hook' },
            allow: {
              to: [
                { type: 'feature-hook', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-service' },
                { type: 'feature-helper', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-types', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'shared' },
                { type: 'app-service' },
                { type: 'util' },
                { type: 'i18n' },
              ],
            },
          },

          // Feature services: may cross-import other features' services.
          // Must NOT import UI layers (screens / components / hooks).
          {
            from: { type: 'feature-service' },
            allow: {
              to: [
                { type: 'feature-service' },   // cross-feature service imports OK
                { type: 'feature-types', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'shared' },
                { type: 'app-service' },
                { type: 'util' },
                { type: 'i18n' },
              ],
            },
          },

          // Feature helpers: pure helpers — same-feature layers + shared + utils only.
          // Cross-feature service imports are NOT allowed; pass data in as args instead.
          {
            from: { type: 'feature-helper' },
            allow: {
              to: [
                { type: 'feature-service', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'feature-types', captured: { featureName: '{{ from.captured.featureName }}' } },
                { type: 'shared' },
                { type: 'util' },
                { type: 'i18n' },
              ],
            },
          },

          // Feature types: may only reference shared types.
          {
            from: { type: 'feature-types' },
            allow: { to: { type: 'shared' } },
          },

          // Shared (atoms, components, providers, store): no feature imports.
          {
            from: { type: 'shared' },
            allow: { to: { type: ['shared', 'app-service', 'util', 'i18n'] } },
          },

          // App-wide services (DB, notifications, openfoodfacts): no feature UI.
          {
            from: { type: 'app-service' },
            allow: { to: { type: ['app-service', 'shared', 'util', 'i18n'] } },
          },

          // Utilities: standalone — only import other utils.
          {
            from: { type: 'util' },
            allow: { to: { type: 'util' } },
          },

          // i18n: standalone — only imports utils.
          {
            from: { type: 'i18n' },
            allow: { to: { type: ['i18n', 'util'] } },
          },
        ],
      }],
    },
  },
]);
