import Button from "@/src/shared/atoms/Button";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { AiToolCall } from "../types/toolDefinitionTypes";
import { buildToolRequestContent, getToolDisplayName } from "../services/toolMessages";

interface ToolApprovalBannerProps {
    toolCall: AiToolCall;
    colors: ThemeColors;
    onApprove: () => void;
    onDeny: () => void;
}

export default function ToolApprovalBanner({ toolCall, colors, onApprove, onDeny }: ToolApprovalBannerProps) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const displayName = getToolDisplayName(toolCall.name);
    const actionDetail = buildToolRequestContent(toolCall.name, toolCall.arguments);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="construct-outline" size={16} color={colors.primary} />
                <Text style={styles.name}>{displayName}</Text>
            </View>
            <Text style={styles.permission}>
                {t("chat.toolPermission", { tool: displayName })}
            </Text>
            <Text style={styles.detail}>{actionDetail}</Text>
            <View style={styles.buttons}>
                <Button title={t("chat.allow")} onPress={onApprove} variant="primary" style={styles.btn} />
                <Button title={t("chat.deny")} onPress={onDeny} variant="outline" style={styles.btn} />
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginBottom: spacing.xs,
        },
        name: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.primary,
        },
        permission: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
        },
        detail: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
            marginBottom: spacing.sm,
        },
        buttons: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        btn: {
            flex: 1,
        },
    });
}
