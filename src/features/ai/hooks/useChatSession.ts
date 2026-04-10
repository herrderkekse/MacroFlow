import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Keyboard, type ScrollView, type TextInput } from "react-native";
import type { AiToolCall } from "../helpers/tools";
import { loadAiConfig } from "../services/aiConfig";
import type { UiChatMessage } from "../services/chat";
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
} from "../services/chatDb";
import type { AiMealPlanEntry } from "../types/types";
import { useChatActions } from "./useChatActions";

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

function deriveSessionTitle(text: string): string {
    const trimmed = text.trim();
    return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
}

interface UseChatSessionOptions {
    onVisibilityChange?: (visible: boolean) => void;
    onDataChanged?: () => void;
}

export function useChatSession({ onVisibilityChange, onDataChanged }: UseChatSessionOptions) {
    const { t } = useTranslation();

    const [hasAiConfig, setHasAiConfig] = useState(false);
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
    const [isAtLatestSession, setIsAtLatestSession] = useState(true);
    const sessionListRef = useRef<FlatList>(null);

    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);
    const messagesRef = useRef<UiChatMessage[]>([]);
    messagesRef.current = messages;

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // ── Keyboard tracking ─────────────────────────────────
    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardHeight(0);
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // ── AI config check ───────────────────────────────────
    useFocusEffect(
        useCallback(() => {
            loadAiConfig().then((config) => {
                const visible = !!config?.apiKey;
                setHasAiConfig(visible);
                onVisibilityChange?.(visible);
            });
        }, [onVisibilityChange]),
    );

    // ── Session initialization ────────────────────────────
    useEffect(() => {
        const existing = getAllChatSessions();
        const newest = existing[0];
        const newestIsEmpty = newest ? getChatMessages(newest.id).length === 0 : false;

        if (newestIsEmpty && newest) {
            setSessions(existing);
            setActiveSessionId(newest.id);
        } else {
            const fresh = createChatSession(t("chat.newSession"));
            setSessions([fresh, ...existing]);
            setActiveSessionId(fresh.id);
        }
        setMessages([]);
        setIsAtLatestSession(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Session management ────────────────────────────────
    const switchSession = useCallback((sessionId: number, allSessions?: ChatSession[]) => {
        if (sessionId === activeSessionId || loading) return;
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setStreamingText("");
        setStreamingToolData(null);
        setActiveSessionId(sessionId);
        const rows = getChatMessages(sessionId);
        setMessages(rows.map(rowToUiMessage));
        const list = allSessions ?? sessions;
        setIsAtLatestSession(list.length === 0 || list[0].id === sessionId);
    }, [activeSessionId, loading, sessions]);

    const handleNewSession = useCallback(() => {
        if (loading) return;
        if (messages.length === 0 && activeSessionId != null) {
            setIsAtLatestSession(true);
            setTimeout(() => sessionListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
            return;
        }
        const fresh = createChatSession(t("chat.newSession"));
        setSessions((prev) => [fresh, ...prev]);
        setActiveSessionId(fresh.id);
        setMessages([]);
        setPendingToolCall(null);
        setPendingToolCallId(undefined);
        setStreamingText("");
        setStreamingToolData(null);
        setIsAtLatestSession(true);
        setTimeout(() => sessionListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
    }, [loading, t, messages.length, activeSessionId]);

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

    // ── Auto-scroll on new messages ───────────────────────
    useEffect(() => {
        if (messages.length > 0 || streamingText) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, streamingText]);

    // ── Message persistence + title ───────────────────────
    const addMessage = useCallback((msg: UiChatMessage) => {
        if (msg.role === "tool-request" && msg.toolCall) {
            setPendingToolCall(msg.toolCall);
            setPendingToolCallId(msg.toolCallId);
        }
        if (msg.role === "tool-result" && msg.toolResult?.success) {
            onDataChanged?.();
        }
        if (activeSessionId != null) {
            persistMessage(activeSessionId, msg);
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

    // ── Chat actions (send, approve, decline, retry, etc.) ─
    const {
        handleSend,
        handleApproveTool,
        handleDeclineTool,
        handleMealPlanImport,
        handleMealPlanDismiss,
        handleStop,
        handleRetry,
    } = useChatActions({
        messagesRef,
        loading,
        setLoading,
        setStreamingText,
        setStreamingToolData,
        pendingToolCall,
        setPendingToolCall,
        pendingToolCallId,
        setPendingToolCallId,
        addMessage,
        inputText,
        setInputText,
        messages,
        setMessages,
        onDataChanged,
    });

    const handleCopy = useCallback(async (text: string) => {
        await Clipboard.setStringAsync(text);
    }, []);

    const lastAssistantActionIdx = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") return i;
        }
        return -1;
    }, [messages]);

    return {
        hasAiConfig,
        inputText,
        setInputText,
        messages,
        loading,
        streamingText,
        pendingToolCall,
        streamingToolData,
        sessions,
        activeSessionId,
        isAtLatestSession,
        keyboardHeight,
        lastAssistantActionIdx,
        // Refs
        scrollRef,
        inputRef,
        sessionListRef,
        // Handlers
        switchSession,
        handleNewSession,
        handleDeleteSession,
        handleSend,
        handleApproveTool,
        handleDeclineTool,
        handleMealPlanImport,
        handleMealPlanDismiss,
        handleStop,
        handleCopy,
        handleRetry,
    };
}
