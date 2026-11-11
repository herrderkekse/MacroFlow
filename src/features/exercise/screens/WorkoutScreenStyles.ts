import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";

export function createWorkoutScreenStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
        },
        list: {
            paddingHorizontal: screenPadding,
            paddingTop: spacing.sm,
            paddingBottom: 100,
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
        addBtn: {
            marginTop: spacing.sm,
        },
        draggingCard: {
            opacity: 0.95,
            transform: [{ scale: 1.01 }],
        },
    });
}
