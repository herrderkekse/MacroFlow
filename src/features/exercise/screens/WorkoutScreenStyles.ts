import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
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
            // Grows to the footer, so an empty workout's placeholder can centre in the free space.
            flexGrow: 1,
        },
        // Matches the recipe editor's empty ingredient list.
        emptyWrap: { flex: 1 },
        empty: { paddingVertical: spacing.xl },
        draggingCard: {
            opacity: 0.95,
            transform: [{ scale: 1.01 }],
        },
    });
}
