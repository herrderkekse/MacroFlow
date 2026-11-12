import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";

export function createWorkoutScreenStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
        },
        listContainer: { flex: 1 },
        list: {
            paddingHorizontal: screenPadding,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
        },
        emptyWrap: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl,
            gap: spacing.sm + 4,
        },
        emptyText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            textAlign: "center",
        },
        draggingCard: {
            opacity: 0.95,
            transform: [{ scale: 1.01 }],
        },
    });
}
