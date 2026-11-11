import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface NoticeProps {
    children: string;
    tone?: "info" | "warning" | "danger";
    /** Optional control at the end, normally a small ghost `Button` ("Retry"). */
    action?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

const ICONS = {
    info: "information-circle-outline",
    warning: "alert-circle-outline",
    danger: "warning-outline",
} as const;

/** The one inline banner for hints, caveats and errors inside a screen or sheet. */
export default function Notice({ children, tone = "info", action, style }: NoticeProps) {
    const colors = useThemeColors();
    const tint = tone === "danger" ? colors.danger : tone === "warning" ? colors.warning : colors.textSecondary;
    const background = tone === "danger" ? colors.dangerLight : colors.surfaceMuted;

    return (
        <View style={[styles.container, { backgroundColor: background, borderColor: tone === "danger" ? colors.dangerLight : colors.border }, style]}>
            <Ionicons name={ICONS[tone]} size={18} color={tint} />
            <Text style={[styles.text, { color: tone === "danger" ? colors.danger : colors.textSecondary }]}>{children}</Text>
            {action}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    text: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
});
