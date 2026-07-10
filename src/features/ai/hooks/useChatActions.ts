import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AiToolCall } from "../helpers/tools";
import type { UiChatMessage } from "../services/chat";
import {
    declineToolCall,
    executeApprovedTool,
    sendChatMessage,
} from "../services/chat";
import { importMealPlanEntries } from "../services/mealPlanService";
import type { AiMealPlanEntry } from "../types/types";

interface UseChatActionsOptions {
    messagesRef: React.MutableRefObject<UiChatMessage[]>;
    loading: boolean;
    setLoading: (v: boolean) => void;
    setStreamingText: (v: string) => void;
    setStreamingToolData: (v: AiMealPlanEntry[] | null) => void;
    pendingToolCall: AiToolCall | null;
    setPendingToolCall: (v: AiToolCall | null) => void;
    pendingToolCallId: string | undefined;
    setPendingToolCallId: (v: string | undefined) => void;
    addMessage: (msg: UiChatMessage) => void;
    inputText: string;
    setInputText: (v: string) => void;
    messages: UiChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
    onDataChanged?: () => void;
}

export function useChatActions(opts: UseChatActionsOptions) {
    const { t } = useTranslation();
    const {
        messagesRef, loading, setLoading, setStreamingText, setStreamingToolData,
        pendingToolCall, setPendingToolCall, pendingToolCallId, setPendingToolCallId,
        addMessage, inputText, setInputText, messages, setMessages, onDataChanged,
    } = opts;
    const abortRef = useRef<AbortController | null>(null);
    const streamingTextRef = useRef("");

    const handleSend = useCallback(async (openSheet: () => void, isOpen: boolean) => {
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
                onStreamToken: (accumulated) => {
                    setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            streamingTextRef.current = "";
            abortRef.current = null;
        }
    }, [inputText, loading, addMessage, t, setInputText, setLoading, setStreamingText, messagesRef]);

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
                onStreamToken: (accumulated) => {
                    setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                onStreamingToolData: (data) => {
                    if (data.mealPlanEntries && data.mealPlanEntries.length > 0) {
                        setStreamingToolData(data.mealPlanEntries);
                    }
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            streamingTextRef.current = "";
            setStreamingToolData(null);
            abortRef.current = null;
        }
    }, [pendingToolCall, pendingToolCallId, loading, addMessage, t, setPendingToolCall, setPendingToolCallId, setLoading, setStreamingText, setStreamingToolData, messagesRef]);

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
                onStreamToken: (accumulated) => {
                    setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            setLoading(false);
            setStreamingText("");
            streamingTextRef.current = "";
            abortRef.current = null;
        }
    }, [pendingToolCall, pendingToolCallId, loading, addMessage, t, setPendingToolCall, setPendingToolCallId, setLoading, setStreamingText, messagesRef]);

    const handleMealPlanImport = useCallback((msgId: string) => {
        setMessages((prev) => {
            const msg = prev.find((m) => m.id === msgId);
            if (!msg?.toolResultData?.mealPlanEntries) return prev;
            const count = importMealPlanEntries(msg.toolResultData.mealPlanEntries);
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
    }, [t, onDataChanged, setMessages]);

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
    }, [t, setMessages]);

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const handleRetry = useCallback(async () => {
        if (loading) return;

        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                lastUserIdx = i;
                break;
            }
        }
        if (lastUserIdx < 0) return;

        const lastUserMsg = messages[lastUserIdx];
        const kept = messages.slice(0, lastUserIdx);
        setMessages(kept);

        setLoading(true);
        setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await sendChatMessage({
                messages: kept,
                userText: lastUserMsg.content,
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
    }, [loading, messages, addMessage, t, setMessages, setLoading, setStreamingText]);

    return {
        handleSend,
        handleApproveTool,
        handleDeclineTool,
        handleMealPlanImport,
        handleMealPlanDismiss,
        handleStop,
        handleRetry,
    };
}
