export const lightColors = {
    background: "#F9FAFB",
    surface: "#FFFFFF",
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
    text: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    border: "#E5E7EB",
    danger: "#EF4444",
    success: "#10B981",
    // Macro colours
    calories: "#10B981",
    protein: "#3B82F6",
    carbs: "#F59E0B",
    fat: "#EF4444",
    weight: "#8B5CF6",
    disabled: "#D1D5DB",
} as const;

export const darkColors = {
    background: "#111827",
    surface: "#1F2937",
    primary: "#3B82F6",
    primaryLight: "#1E3A5F",
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    border: "#374151",
    danger: "#EF4444",
    success: "#10B981",
    // Macro colours
    calories: "#10B981",
    protein: "#60A5FA",
    carbs: "#FBBF24",
    fat: "#F87171",
    weight: "#A78BFA",
    disabled: "#4B5563",
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
    sm: 6,
    md: 10,
    lg: 16,
} as const;

export const fontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
} as const;
