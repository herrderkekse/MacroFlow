/**
 * Design tokens.
 *
 * The palette is deliberately quiet: a warm neutral canvas, ink-coloured
 * controls and hairline structure. Hue is reserved for meaning — the macro
 * colours, status colours and the muscle-group dots — so a coloured number
 * always says the same thing wherever it appears.
 *
 * `primary` is the ink colour (near-black in light mode, near-white in dark
 * mode). Anything drawn on top of it must use `onPrimary`, never a literal
 * white.
 */
export const lightColors = {
    background: "#F4F2EF",
    surface: "#FFFFFF",
    /** Inset areas inside a surface: input wells, nested rows, pressed states. */
    surfaceMuted: "#F7F5F2",
    primary: "#171614",
    /** Text and icons placed on `primary`. */
    onPrimary: "#FBFAF8",
    /** Tonal fill for selected / highlighted states. */
    primaryLight: "#ECE9E4",
    text: "#171614",
    textSecondary: "#6E6A63",
    textTertiary: "#8F8A82",
    border: "#E7E3DD",
    /** Outline of interactive controls (inputs, outline buttons, chips). */
    borderStrong: "#D9D4CC",
    danger: "#B3402E",
    dangerLight: "#F6E4E0",
    warning: "#A6741F",
    success: "#3F7D58",
    /** Scrim behind sheets and dialogs. */
    overlay: "rgba(23, 22, 20, 0.45)",
    // Macro colours
    calories: "#171614",
    protein: "#3F6FA8",
    carbs: "#B5842F",
    fat: "#A9503C",
    weight: "#6B5FA0",
    exercise: "#4F8A7A",
    exerciseChest: "#B4567E",
    exerciseBack: "#3F6FA8",
    exerciseLegs: "#B5842F",
    exerciseShoulders: "#6B5FA0",
    exerciseArms: "#4F8A5F",
    exerciseCore: "#B8683A",
    exerciseFullBody: "#3D8C8C",
    disabled: "#D9D4CC",
} as const;

export const darkColors = {
    background: "#121110",
    surface: "#1C1B19",
    surfaceMuted: "#242321",
    primary: "#F4F2EF",
    onPrimary: "#171614",
    primaryLight: "#302E2B",
    text: "#F4F2EF",
    textSecondary: "#A8A39B",
    textTertiary: "#7D7972",
    border: "#2E2C29",
    borderStrong: "#45423D",
    danger: "#E0715C",
    dangerLight: "#3A221D",
    warning: "#D9A94E",
    success: "#6FB58A",
    overlay: "rgba(0, 0, 0, 0.6)",
    // Macro colours
    calories: "#F4F2EF",
    protein: "#7BA7DB",
    carbs: "#D9A94E",
    fat: "#D98670",
    weight: "#A99DDB",
    exercise: "#7FBBAA",
    exerciseChest: "#DB8AAC",
    exerciseBack: "#7BA7DB",
    exerciseLegs: "#D9A94E",
    exerciseShoulders: "#A99DDB",
    exerciseArms: "#86BF95",
    exerciseCore: "#DE9468",
    exerciseFullBody: "#72BDBD",
    disabled: "#45423D",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

/** @deprecated Use useThemeColors() hook instead */
export const colors = lightColors;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
} as const;

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 18,
    /** Top corners of sheets. */
    xl: 24,
    full: 999,
} as const;

export const fontSize = {
    /** Uppercase section labels only. */
    xxs: 11,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    /** Large titles of tab roots and hero numbers. */
    xxl: 28,
} as const;

/** Shared control metrics, so inputs, buttons and chips line up everywhere. */
export const controlHeight = {
    sm: 36,
    md: 48,
} as const;

/** Space every screen keeps between its content and the screen edge. */
export const screenPadding = spacing.md;

/** The single elevation used by floating elements (FAB, floating bars). */
export const floatingShadow = {
    elevation: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
} as const;
