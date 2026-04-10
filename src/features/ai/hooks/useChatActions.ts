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
    const abortRef = useRef<AbortController | null>(null);
    const streamingTextRef = useRef("");

    const handleSend = useCallback(async (openSheet: () => void, isOpen: boolean) => {
        const text = opts.inputText.trim();
        if (!text || opts.loading) return;

        if (!isOpen) openSheet();
        opts.setInputText("");
        opts.setLoading(true);
        opts.setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await sendChatMessage({
                messages: opts.messagesRef.current,
                userText: text,
                onMessage: opts.addMessage,
                onStreamToken: (accumulated) => {
                    opts.setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    opts.addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            opts.addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            opts.setLoading(false);
            opts.setStreamingText("");
            streamingTextRef.current = "";
            abortRef.current = null;
        }
    }, [opts.inputText, opts.loading, opts.addMessage, t]);

    const handleApproveTool = useCallback(async () => {
        if (!opts.pendingToolCall || opts.loading) return;

        const toolCall = opts.pendingToolCall;
        const toolCallId = opts.pendingToolCallId;
        opts.setPendingToolCall(null);
        opts.setPendingToolCallId(undefined);
        opts.setLoading(true);
        opts.setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await executeApprovedTool({
                messages: opts.messagesRef.current,
                toolCall,
                toolCallId,
                onMessage: opts.addMessage,
                onStreamToken: (accumulated) => {
                    opts.setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                onStreamingToolData: (data) => {
                    if (data.mealPlanEntries && data.mealPlanEntries.length > 0) {
                        opts.setStreamingToolData(data.mealPlanEntries);
                    }
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    opts.addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            opts.addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            opts.setLoading(false);
            opts.setStreamingText("");
            streamingTextRef.current = "";
            opts.setStreamingToolData(null);
            abortRef.current = null;
        }
    }, [opts.pendingToolCall, opts.pendingToolCallId, opts.loading, opts.addMessage, t]);

    const handleDeclineTool = useCallback(async () => {
        if (!opts.pendingToolCall || opts.loading) return;

        const toolCall = opts.pendingToolCall;
        const toolCallId = opts.pendingToolCallId;
        opts.setPendingToolCall(null);
        opts.setPendingToolCallId(undefined);
        opts.setLoading(true);
        opts.setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await declineToolCall({
                messages: opts.messagesRef.current,
                toolCall,
                toolCallId,
                onMessage: opts.addMessage,
                onStreamToken: (accumulated) => {
                    opts.setStreamingText(accumulated);
                    streamingTextRef.current = accumulated;
                },
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") {
                const partial = streamingTextRef.current.trim();
                if (partial) {
                    opts.addMessage({
                        id: `stop_${Date.now()}`,
                        role: "assistant",
                        content: partial,
                        timestamp: Date.now(),
                    });
                }
                return;
            }
            opts.addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            opts.setLoading(false);
            opts.setStreamingText("");
            streamingTextRef.current = "";
            abortRef.current = null;
        }
    }, [opts.pendingToolCall, opts.pendingToolCallId, opts.loading, opts.addMessage, t]);

    const handleMealPlanImport = useCallback((msgId: string) => {
        opts.setMessages((prev) => {
            const msg = prev.find((m) => m.id === msgId);
            if (!msg?.toolResultData?.mealPlanEntries) return prev;
            const count = importMealPlanEntries(msg.toolResultData.mealPlanEntries);
            opts.onDataChanged?.();
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
    }, [t, opts.onDataChanged]);

    const handleMealPlanDismiss = useCallback((msgId: string) => {
        opts.setMessages((prev) =>
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

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const handleRetry = useCallback(async () => {
        if (opts.loading) return;

        let lastUserIdx = -1;
        for (let i = opts.messages.length - 1; i >= 0; i--) {
            if (opts.messages[i].role === "user") {
                lastUserIdx = i;
                break;
            }
        }
        if (lastUserIdx < 0) return;

        const lastUserMsg = opts.messages[lastUserIdx];
        const kept = opts.messages.slice(0, lastUserIdx);
        opts.setMessages(kept);
        opts.messagesRef.current = kept;

        opts.setLoading(true);
        opts.setStreamingText("");
        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await sendChatMessage({
                messages: kept,
                userText: lastUserMsg.content,
                onMessage: opts.addMessage,
                onStreamToken: (accumulated) => opts.setStreamingText(accumulated),
                signal: abort.signal,
            });
        } catch (e: any) {
            if (e.name === "AbortError") return;
            opts.addMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: t("chat.error", { message: e.message ?? t("common.unknownError") }),
                timestamp: Date.now(),
            });
        } finally {
            opts.setLoading(false);
            opts.setStreamingText("");
            abortRef.current = null;
        }
    }, [opts.loading, opts.messages, opts.addMessage, t]);

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
