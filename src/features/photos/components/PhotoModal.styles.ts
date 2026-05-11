import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";

export function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.86)",
            paddingHorizontal: spacing.sm,
        },
        container: {
            flex: 1,
        },
        content: {
            flex: 1,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
            backgroundColor: "rgba(7, 9, 13, 0.94)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
        },
        carousel: { flex: 1 },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
        },
        counter: {
            color: "#E9EEF7",
            fontSize: fontSize.sm,
            fontWeight: "600",
        },
        closeButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
        },
        imageSlide: {
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
        },
        image: {
            width: "100%",
            height: "100%",
            backgroundColor: colors.surface,
        },
        imageFallback: {
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
        },
        imageFallbackText: {
            color: colors.textSecondary,
            fontSize: fontSize.lg,
        },
        metaSection: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            gap: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.1)",
        },
        metaLabel: {
            color: "#9FA8B8",
            fontSize: fontSize.xs,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginTop: spacing.xs,
        },
        metaValue: {
            color: "#F3F6FC",
            fontSize: fontSize.md,
            fontWeight: "600",
        },
        noteText: {
            color: "#D5DDEB",
            fontSize: fontSize.sm,
            lineHeight: 20,
        },
    });
}