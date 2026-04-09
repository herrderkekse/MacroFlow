import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { UiChatMessage } from "../services/chat";

interface ChatBubbleProps {
    message: UiChatMessage;
    colors: ThemeColors;
    showActions?: boolean;
    onCopy?: (text: string) => Promise<void>;
    onRetry?: () => void;
}

export default function ChatBubble({ message, colors, showActions, onCopy, onRetry }: ChatBubbleProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";
    const isToolRequest = message.role === "tool-request";
    const isToolResult = message.role === "tool-result";

    const handleCopy = useCallback(async () => {
        await onCopy?.(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [onCopy, message.content]);

    return (
        <View
            style={[
                styles.bubble,
                isUser ? styles.bubbleUser : styles.bubbleAssistant,
                isUser
                    ? { backgroundColor: colors.primary }
                    : isToolRequest || isToolResult
                        ? { backgroundColor: colors.primaryLight, borderColor: colors.border, borderWidth: 1 }
                        : { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
            ]}
        >
            {(isToolRequest || isToolResult) && (
                <View style={styles.toolLabel}>
                    <Ionicons
                        name={isToolRequest ? "construct-outline" : "checkmark-circle-outline"}
                        size={14}
                        color={colors.primary}
                    />
                    <Text style={[styles.toolLabelText, { color: colors.primary }]}>
                        {isToolRequest ? "Tool" : "Result"}
                    </Text>
                </View>
            )}
            <Text
                style={[
                    styles.text,
                    { color: isUser ? "#fff" : colors.text },
                ]}
            >
                {message.content}
            </Text>
            {showActions && !isUser && message.content.length > 0 && (
                <View style={styles.actions}>
                    <Pressable onPress={handleCopy} hitSlop={8} style={styles.actionBtn}>
                        <Ionicons
                            name={copied ? "checkmark" : "copy-outline"}
                            size={15}
                            color={copied ? colors.success : colors.textTertiary}
                        />
                        <Text style={[styles.actionText, { color: copied ? colors.success : colors.textTertiary }]}>
                            {copied ? t("chat.copied") : t("chat.copy")}
                        </Text>
                    </Pressable>
                    <Pressable onPress={onRetry} hitSlop={8} style={styles.actionBtn}>
                        <Ionicons name="refresh-outline" size={15} color={colors.textTertiary} />
                        <Text style={[styles.actionText, { color: colors.textTertiary }]}>
                            {t("chat.retry")}
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    bubble: {
        maxWidth: "85%",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    bubbleUser: {
        alignSelf: "flex-end",
    },
    bubbleAssistant: {
        alignSelf: "flex-start",
    },
    text: {
        fontSize: fontSize.md,
        lineHeight: 22,
    },
    toolLabel: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginBottom: 4,
    },
    toolLabelText: {
        fontSize: fontSize.xs,
        fontWeight: "600",
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0,0,0,0.08)",
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingVertical: 2,
    },
    actionText: {
        fontSize: fontSize.xs,
        fontWeight: "500",
    },
});
