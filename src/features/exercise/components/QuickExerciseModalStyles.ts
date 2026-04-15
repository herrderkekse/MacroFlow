import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";

export function createQuickExerciseStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
        },
        sheet: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            padding: spacing.lg,
            maxHeight: "70%",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        pickerBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
        },
        pickerText: {
            fontSize: fontSize.sm,
            color: colors.text,
        },
        pickerPlaceholder: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
        },
        fieldGroup: {
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        field: {
            marginBottom: 0,
        },
        saveBtn: {
            marginTop: spacing.sm,
        },
    });
}
