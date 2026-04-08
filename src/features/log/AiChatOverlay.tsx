import BottomSheet, { type BottomSheetRef } from "@/src/components/BottomSheet";
import Button from "@/src/components/Button";
import { loadAiConfig } from "@/src/services/ai";
import type { UiChatMessage } from "@/src/services/ai/chat";
import {
    declineToolCall,
    executeApprovedTool,
    sendChatMessage,
} from "@/src/services/ai/chat";
import type { AiToolCall } from "@/src/services/ai/tools";
import { importMealPlanEntries } from "@/src/services/ai/tools";
import type { AiMealPlanEntry } from "@/src/services/ai/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MealPlanToolResult, ToolResultContainer } from "./tool-results";

// ── Constants ─────────────────────────────────────────────

const INPUT_BAR_HEIGHT = 52;
const INPUT_BAR_MARGIN = spacing.sm;

/** Total vertical space consumed by the floating chat input bar. */
export const CHAT_BAR_TOTAL_HEIGHT = INPUT_BAR_HEIGHT + INPUT_BAR_MARGIN * 2;

interface AiChatOverlayProps {
    /** Height of the bottom tab bar so we can position above it. */
    tabBarHeight: number;
    /** Called when AI config availability changes (true = chat bar visible). */
    onVisibilityChange?: (visible: boolean) => void;
    /** Called when a tool action modifies log data (e.g. meal plan imported). */
    onDataChanged?: () => void;
}

export default function AiChatOverlay({ tabBarHeight, onVisibilityChange, onDataChanged }: AiChatOverlayProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const [hasAiConfig, setHasAiConfig] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState("");
    const [messages, setMessages] = useState<UiChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [pendingToolCall, setPendingToolCall] = useState<AiToolCall | null>(null);
    const [pendingToolCallId, setPendingToolCallId] = useState<string | undefined>(undefined);
    const [streamingToolData, setStreamingToolData] = useState<AiMealPlanEntry[] | null>(null);

    const scrollRef = useRef<ScrollView>(null);
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<TextInput>(null);
    const sheetRef = useRef<BottomSheetRef>(null);
    const messagesRef = useRef<UiChatMessage[]>([]);
    messagesRef.current = messages;

    const screenHeight = Dimensions.get("window").height;
    const sheetOpenHeight = Math.round(screenHeight * 0.9);
    const snapPoints = useMemo(() => [1, sheetOpenHeight], [sheetOpenHeight]);

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardHeight(0);
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // tabBarHeight includes the bottom safe area inset, but on Android the keyboard
    // height is measured from above the gesture bar — subtract only the visible
    // tab bar height to avoid double-counting the safe area.
    const visibleTabBarHeight = tabBarHeight - insets.bottom;
    const inputBottom = keyboardHeight > 0
        ? keyboardHeight - visibleTabBarHeight + INPUT_BAR_MARGIN
        : INPUT_BAR_MARGIN;

    // Check if AI is configured
    useEffect(() => {
        loadAiConfig().then((config) => {
            const visible = !!config?.apiKey;
            setHasAiConfig(visible);
            onVisibilityChange?.(visible);
        });
    }, [onVisibilityChange]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messages.length > 0 || streamingText) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, streamingText]);

    const handleSnapChange = useCallback((index: number) => {
        if (index === 0) {
            setIsOpen(false);
            Keyboard.dismiss();
        } else {
            setIsOpen(true);
        }
    }, []);

    const openSheet = useCallback(() => {
        setIsOpen(true);
        sheetRef.current?.snapTo(1);
    }, []);

    const closeSheet = useCallback(() => {
        sheetRef.current?.snapTo(0);
    }, []);

    const addMessage = useCallback((msg: UiChatMessage) => {
        if (msg.role === "tool-request" && msg.toolCall) {
            setPendingToolCall(msg.toolCall);
            setPendingToolCallId(msg.toolCallId);
        }
        // Notify parent when a data-modifying tool executed successfully
        if (msg.role === "tool-result" && msg.toolResult?.success) {
            onDataChanged?.();
        }
        setMessages((prev) => [...prev, msg]);
        setStreamingText("");
    }, [onDataChanged]);

    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || loading) return;

        if (!isOpen) openSheet();
        setInputText("");
        setLoading(true);
        setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await sendChatMessage({
                messages: messagesRef.current,
                userText: text,
                onMessage: addMessage,
                onStreamToken: (accumulated) => setStreamingText(accumulated),
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") return;
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            abortRef.current = null;
        }
    }, [inputText, loading, isOpen, openSheet, addMessage, t]);

    const handleApproveTool = useCallback(async () => {
        if (!pendingToolCall || loading) return;

        const toolCall = pendingToolCall;
        const toolCallId = pendingToolCallId;
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setLoading(true);
        setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await executeApprovedTool({
                messages: messagesRef.current,
                toolCall,
                toolCallId,
                onMessage: addMessage,
                onStreamToken: (accumulated) => setStreamingText(accumulated),
                onStreamingToolData: (data) => {
                    if (data.mealPlanEntries && data.mealPlanEntries.length > 0) {
                        setStreamingToolData(data.mealPlanEntries);
                    }
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") return;
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            setStreamingToolData(null);
            abortRef.current = null;
        }
    }, [pendingToolCall, pendingToolCallId, loading, addMessage, t]);

    const handleDeclineTool = useCallback(async () => {
        if (!pendingToolCall || loading) return;

        const toolCall = pendingToolCall;
        const toolCallId = pendingToolCallId;
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setLoading(true);
        setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await declineToolCall({
                messages: messagesRef.current,
                toolCall,
                toolCallId,
                onMessage: addMessage,
                onStreamToken: (accumulated) => setStreamingText(accumulated),
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") return;
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            abortRef.current = null;
        }
    }, [pendingToolCall, pendingToolCallId, loading, addMessage, t]);

    // Handle meal plan import from tool result
    const handleMealPlanImport = useCallback((msgId: string) => {
        setMessages((prev) => {
            const msg = prev.find((m) => m.id === msgId);
            if (!msg?.toolResultData?.mealPlanEntries) return prev;
            const count = importMealPlanEntries(msg.toolResultData.mealPlanEntries);
            // Notify parent that log data changed
            onDataChanged?.();
            return prev.map((m) =>
                m.id === msgId
                    ? {
                        ...m,
                        toolResultData: { ...m.toolResultData!, imported: true },
                        content: t("chat.mealPlanImported", { count }),
                    }
                    : m,
            );
        });
    }, [t, onDataChanged]);

    const handleMealPlanDismiss = useCallback((msgId: string) => {
        setMessages((prev) =>
            prev.map((m) =>
                m.id === msgId
                    ? {
                        ...m,
                        toolResultData: { ...m.toolResultData!, dismissed: true },
                        content: t("chat.mealPlanDismissed"),
                    }
                    : m,
            ),
        );
    }, [t]);

    if (!hasAiConfig) return null;

    return (
        <>
            {/* Bottom Sheet (chat history) */}
            <BottomSheet
                ref={sheetRef}
                snapPoints={snapPoints}
                initialIndex={0}
                onSnapChange={handleSnapChange}
            >
                {/* Chat header */}
                <View style={styles.chatHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                    <Text style={styles.chatHeaderText}>{t("chat.title")}</Text>
                    <Pressable onPress={closeSheet} hitSlop={8}>
                        <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.messageList}
                    contentContainerStyle={[
                        styles.messageListContent,
                        { paddingBottom: INPUT_BAR_HEIGHT + spacing.lg },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {messages.length === 0 && !loading && (
                        <View style={styles.emptyState}>
                            <Ionicons name="sparkles-outline" size={32} color={colors.textTertiary} />
                            <Text style={styles.emptyStateText}>{t("chat.emptyHint")}</Text>
                        </View>
                    )}

                    {messages.map((msg) => (
                        <React.Fragment key={msg.id}>
                            <MessageBubble message={msg} colors={colors} />
                            {msg.toolResultData &&
                                !msg.toolResultData.imported &&
                                !msg.toolResultData.dismissed && (
                                    <ToolResultContainer
                                        message={msg}
                                        colors={colors}
                                        onImport={handleMealPlanImport}
                                        onDismiss={handleMealPlanDismiss}
                                    />
                                )}
                        </React.Fragment>
                    ))}

                    {/* Streaming tool preview (e.g. meal plan building up) */}
                    {loading && streamingToolData && streamingToolData.length > 0 && (
                        <MealPlanToolResult
                            entries={streamingToolData}
                            colors={colors}
                            generating
                        />
                    )}

                    {/* Streaming text preview */}
                    {loading && !streamingToolData && streamingText ? (
                        <View style={[styles.bubble, styles.bubbleAssistant]}>
                            <Text style={[styles.bubbleText, { color: colors.text }]}>
                                {streamingText}
                            </Text>
                        </View>
                    ) : loading && !streamingToolData ? (
                        <View style={[styles.bubble, styles.bubbleAssistant, styles.loadingBubble]}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                {t("chat.thinking")}
                            </Text>
                        </View>
                    ) : null}

                    {/* Tool approval buttons */}
                    {pendingToolCall && !loading && (
                        <View style={styles.toolApproval}>
                            <Text style={styles.toolApprovalText}>
                                {t("chat.toolPermission", { tool: pendingToolCall.name })}
                            </Text>
                            <View style={styles.toolApprovalButtons}>
                                <Button
                                    title={t("chat.allow")}
                                    onPress={handleApproveTool}
                                    variant="primary"
                                    style={styles.toolBtn}
                                />
                                <Button
                                    title={t("chat.deny")}
                                    onPress={handleDeclineTool}
                                    variant="outline"
                                    style={styles.toolBtn}
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </BottomSheet>

            {/* Floating input bar — always visible, above everything */}
            <View style={[styles.inputBar, { bottom: inputBottom }]}>
                <Pressable style={styles.inputTouchArea} onPress={() => { if (!isOpen) openSheet(); }}>
                    <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={18}
                        color={isOpen ? colors.primary : colors.textTertiary}
                    />
                    <TextInput
                        ref={inputRef}
                        style={styles.inputText}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder={t("chat.placeholder")}
                        placeholderTextColor={colors.textTertiary}
                        onFocus={() => { if (!isOpen) openSheet(); }}
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                        editable={!loading}
                        returnKeyType="send"
                    />
                </Pressable>
                {(inputText.trim().length > 0 || isOpen) && (
                    <Pressable
                        onPress={handleSend}
                        disabled={loading || !inputText.trim()}
                        style={({ pressed }) => [
                            styles.sendBtn,
                            {
                                backgroundColor:
                                    inputText.trim() && !loading
                                        ? colors.primary
                                        : colors.disabled,
                            },
                            pressed && { opacity: 0.8 },
                        ]}
                    >
                        <Ionicons name="send" size={16} color="#fff" />
                    </Pressable>
                )}
            </View>
        </>
    );
}

// ── Message Bubble ────────────────────────────────────────

function MessageBubble({ message, colors }: { message: UiChatMessage; colors: ThemeColors }) {
    const isUser = message.role === "user";
    const isToolRequest = message.role === "tool-request";
    const isToolResult = message.role === "tool-result";

    return (
        <View
            style={[
                mbStyles.bubble,
                isUser ? mbStyles.bubbleUser : mbStyles.bubbleAssistant,
                isUser
                    ? { backgroundColor: colors.primary }
                    : isToolRequest || isToolResult
                        ? { backgroundColor: colors.primaryLight, borderColor: colors.border, borderWidth: 1 }
                        : { backgroundColor: colors.surface },
            ]}
        >
            {(isToolRequest || isToolResult) && (
                <View style={mbStyles.toolLabel}>
                    <Ionicons
                        name={isToolRequest ? "construct-outline" : "checkmark-circle-outline"}
                        size={14}
                        color={colors.primary}
                    />
                    <Text style={[mbStyles.toolLabelText, { color: colors.primary }]}>
                        {isToolRequest ? "Tool" : "Result"}
                    </Text>
                </View>
            )}
            <Text
                style={[
                    mbStyles.text,
                    { color: isUser ? "#fff" : colors.text },
                ]}
            >
                {message.content}
            </Text>
        </View>
    );
}

const mbStyles = StyleSheet.create({
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
});

// ── Styles ────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        chatHeader: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        chatHeaderText: {
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: "600",
            color: colors.text,
        },
        messageList: {
            flex: 1,
        },
        messageListContent: {
            padding: spacing.md,
        },
        emptyState: {
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 60,
            gap: spacing.sm,
        },
        emptyStateText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            paddingHorizontal: spacing.xl,
        },
        bubble: {
            maxWidth: "85%",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            borderRadius: borderRadius.lg,
            marginBottom: spacing.sm,
        },
        bubbleAssistant: {
            alignSelf: "flex-start",
            backgroundColor: colors.surface,
        },
        bubbleText: {
            fontSize: fontSize.md,
            lineHeight: 22,
        },
        loadingBubble: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        loadingText: {
            fontSize: fontSize.sm,
        },
        toolApproval: {
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        toolApprovalText: {
            fontSize: fontSize.sm,
            color: colors.text,
            marginBottom: spacing.sm,
        },
        toolApprovalButtons: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        toolBtn: {
            flex: 1,
        },
        // Floating input bar
        inputBar: {
            position: "absolute",
            left: spacing.md,
            right: spacing.md,
            height: INPUT_BAR_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            elevation: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            zIndex: 110,
        },
        inputTouchArea: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            height: "100%",
        },
        inputText: {
            flex: 1,
            fontSize: fontSize.md,
            color: colors.text,
            paddingVertical: 0,
        },
        sendBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
    });
}
