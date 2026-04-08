import BottomSheet, { type BottomSheetRef } from "@/src/components/BottomSheet";
import Button from "@/src/components/Button";
import {
    addChatMessage,
    createChatSession,
    deleteChatSession,
    getAllChatSessions,
    getChatMessages,
    touchChatSession,
    updateChatSessionTitle,
    type ChatMessageRow,
    type ChatSession,
} from "@/src/db/queries";
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
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
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

// ── DB ↔ UiChatMessage conversion ────────────────────────

function rowToUiMessage(row: ChatMessageRow): UiChatMessage {
    return {
        id: `db_${row.id}`,
        role: row.role as UiChatMessage["role"],
        content: row.content,
        toolCall: row.tool_call_json ? JSON.parse(row.tool_call_json) : undefined,
        toolResult: row.tool_result_json ? JSON.parse(row.tool_result_json) : undefined,
        toolResultData: row.tool_result_data_json ? JSON.parse(row.tool_result_data_json) : undefined,
        toolCallId: row.tool_call_id ?? undefined,
        timestamp: row.timestamp,
    };
}

function persistMessage(sessionId: number, msg: UiChatMessage) {
    addChatMessage({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        tool_call_json: msg.toolCall ? JSON.stringify(msg.toolCall) : null,
        tool_result_json: msg.toolResult ? JSON.stringify(msg.toolResult) : null,
        tool_result_data_json: msg.toolResultData ? JSON.stringify(msg.toolResultData) : null,
        tool_call_id: msg.toolCallId ?? null,
        timestamp: msg.timestamp,
    });
    touchChatSession(sessionId);
}

/** Derive a short title from the first user message. */
function deriveSessionTitle(text: string): string {
    const trimmed = text.trim();
    return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
}

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

    // ── Session state ─────────────────────────────────────
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
    const sessionListRef = useRef<FlatList>(null);

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

    // Check if AI is configured; re-run every time the screen comes into focus
    // so the chat bar appears immediately after credentials are saved.
    useFocusEffect(
        useCallback(() => {
            loadAiConfig().then((config) => {
                const visible = !!config?.apiKey;
                setHasAiConfig(visible);
                onVisibilityChange?.(visible);
            });
        }, [onVisibilityChange]),
    );

    // On mount: always start with a fresh session (issue #156 requirement).
    // Load existing sessions for the selector.
    useEffect(() => {
        const existing = getAllChatSessions();
        const fresh = createChatSession(t("chat.newSession"));
        setSessions([fresh, ...existing]);
        setActiveSessionId(fresh.id);
        setMessages([]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /** Switch to a different session, loading its messages from the DB. */
    const switchSession = useCallback((sessionId: number) => {
        if (sessionId === activeSessionId || loading) return;
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setStreamingText("");
        setStreamingToolData(null);
        setActiveSessionId(sessionId);
        const rows = getChatMessages(sessionId);
        setMessages(rows.map(rowToUiMessage));
    }, [activeSessionId, loading]);

    /** Create a new session and switch to it. */
    const handleNewSession = useCallback(() => {
        if (loading) return;
        const fresh = createChatSession(t("chat.newSession"));
        setSessions((prev) => [fresh, ...prev]);
        setActiveSessionId(fresh.id);
        setMessages([]);
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setStreamingText("");
        setStreamingToolData(null);
        setTimeout(() => sessionListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
    }, [loading, t]);

    /** Long-press to delete a session. */
    const handleDeleteSession = useCallback((session: ChatSession) => {
        if (loading) return;
        Alert.alert(
            t("chat.deleteSession"),
            t("chat.deleteSessionConfirm"),
            [
                { text: t("chat.cancel"), style: "cancel" },
                {
                    text: t("chat.deleteSession"),
                    style: "destructive",
                    onPress: () => {
                        deleteChatSession(session.id);
                        setSessions((prev) => prev.filter((s) => s.id !== session.id));
                        // If the deleted session was active, switch to the first remaining or create a new one
                        if (session.id === activeSessionId) {
                            const remaining = sessions.filter((s) => s.id !== session.id);
                            if (remaining.length > 0) {
                                switchSession(remaining[0].id);
                            } else {
                                handleNewSession();
                            }
                        }
                    },
                },
            ],
        );
    }, [loading, t, activeSessionId, sessions, switchSession, handleNewSession]);

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
        // Persist to DB
        if (activeSessionId != null) {
            persistMessage(activeSessionId, msg);
            // Auto-title the session from the first user message
            if (msg.role === "user") {
                setMessages((prev) => {
                    if (prev.every((m) => m.role !== "user")) {
                        const title = deriveSessionTitle(msg.content);
                        updateChatSessionTitle(activeSessionId, title);
                        setSessions((s) => s.map((sess) => sess.id === activeSessionId ? { ...sess, title, updated_at: Date.now() } : sess));
                    }
                    return [...prev, msg];
                });
                setStreamingText("");
                return;
            }
        }
        setMessages((prev) => [...prev, msg]);
        setStreamingText("");
    }, [onDataChanged, activeSessionId]);

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

                {/* Session selector */}
                <View style={styles.sessionBar}>
                    <FlatList
                        ref={sessionListRef}
                        horizontal
                        data={sessions}
                        keyExtractor={(s) => String(s.id)}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.sessionListContent}
                        ListHeaderComponent={
                            <Pressable
                                onPress={handleNewSession}
                                style={[styles.sessionChip, styles.sessionNewChip, { borderColor: colors.primary }]}
                            >
                                <Ionicons name="add" size={16} color={colors.primary} />
                            </Pressable>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => switchSession(item.id)}
                                onLongPress={() => handleDeleteSession(item)}
                                style={[
                                    styles.sessionChip,
                                    {
                                        backgroundColor: item.id === activeSessionId ? colors.primary : colors.surface,
                                        borderColor: item.id === activeSessionId ? colors.primary : colors.border,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.sessionChipText,
                                        { color: item.id === activeSessionId ? "#fff" : colors.text },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.title}
                                </Text>
                            </Pressable>
                        )}
                    />
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
        sessionBar: {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: spacing.xs,
        },
        sessionListContent: {
            paddingHorizontal: spacing.md,
            gap: spacing.xs,
        },
        sessionChip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs + 2,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            maxWidth: 160,
        },
        sessionNewChip: {
            backgroundColor: "transparent",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.sm,
        },
        sessionChipText: {
            fontSize: fontSize.xs,
            fontWeight: "500",
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
