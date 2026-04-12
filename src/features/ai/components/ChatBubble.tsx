import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
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

    const markdownStyles = useMemo(() => buildMarkdownStyles(colors), [colors]);

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
            {isUser ? (
                <Text style={[styles.text, { color: "#fff" }]}>
                    {message.content}
                </Text>
            ) : (
                <Markdown style={markdownStyles}>
                    {message.content}
                </Markdown>
            )}
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

function buildMarkdownStyles(colors: ThemeColors) {
    return {
        body: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
        heading1: { fontSize: 20, fontWeight: "700" as const, color: colors.text, marginVertical: spacing.xs },
        heading2: { fontSize: 18, fontWeight: "700" as const, color: colors.text, marginVertical: spacing.xs },
        heading3: { fontSize: fontSize.md, fontWeight: "700" as const, color: colors.text, marginVertical: spacing.xs },
        strong: { fontWeight: "700" as const },
        em: { fontStyle: "italic" as const },
        s: { textDecorationLine: "line-through" as const },
        code_inline: {
            fontFamily: "monospace",
            fontSize: fontSize.sm,
            backgroundColor: colors.primaryLight,
            color: colors.primary,
            paddingHorizontal: 4,
            borderRadius: 4,
        },
        fence: {
            fontFamily: "monospace",
            fontSize: fontSize.sm,
            backgroundColor: colors.primaryLight,
            color: colors.text,
            padding: spacing.sm,
            borderRadius: borderRadius.sm,
            marginVertical: spacing.xs,
        },
        blockquote: {
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            paddingLeft: spacing.sm,
            marginVertical: spacing.xs,
            opacity: 0.85,
        },
        bullet_list: { marginVertical: spacing.xs },
        ordered_list: { marginVertical: spacing.xs },
        list_item: { marginVertical: 2 },
        paragraph: { marginVertical: spacing.xs },
        hr: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
    };
}
