import { spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";

export function createWorkoutScreenStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
        },
        list: {
            padding: spacing.md,
            paddingBottom: 100,
        },
        emptyWrap: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl * 2,
            gap: spacing.md,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: "center",
        },
        addBtn: {
            marginTop: spacing.sm,
        },
    });
}
