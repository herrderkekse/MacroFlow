import BottomSheet, { type BottomSheetRef } from "@/src/shared/components/BottomSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatSession } from "../hooks/useChatSession";
import ChatBubble from "./ChatBubble";
import ChatInputBar, { INPUT_BAR_HEIGHT } from "./ChatInputBar";
import MealPlanToolResult from "./MealPlanToolResult";
import ToolApprovalBanner from "./ToolApprovalBanner";
import ToolResultContainer from "./ToolResultContainer";

// ── Constants ─────────────────────────────────────────────

const INPUT_BAR_MARGIN = spacing.sm;

/** Total vertical space consumed by the floating chat input bar. */
export const CHAT_BAR_TOTAL_HEIGHT = INPUT_BAR_HEIGHT + INPUT_BAR_MARGIN * 2;

interface AiChatOverlayProps {
    tabBarHeight: number;
    onVisibilityChange?: (visible: boolean) => void;
    onDataChanged?: () => void;
}

export default function AiChatOverlay({ tabBarHeight, onVisibilityChange, onDataChanged }: AiChatOverlayProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const sheetRef = useRef<BottomSheetRef>(null);
    const [isOpen, setIsOpen] = useState(false);

    const chat = useChatSession({ onVisibilityChange, onDataChanged });

    const screenHeight = Dimensions.get("window").height;
    const sheetOpenHeight = Math.round(screenHeight * 0.9);
    const snapPoints = useMemo(() => [1, sheetOpenHeight], [sheetOpenHeight]);

    const visibleTabBarHeight = tabBarHeight - insets.bottom;
    const inputBottom = chat.keyboardHeight > 0
        ? chat.keyboardHeight - visibleTabBarHeight + INPUT_BAR_MARGIN
        : INPUT_BAR_MARGIN;

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

    const onSend = useCallback(() => {
        chat.handleSend(openSheet, isOpen);
    }, [chat, openSheet, isOpen]);

    if (!chat.hasAiConfig) return null;

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
                        ref={chat.sessionListRef}
                        horizontal
                        data={chat.sessions}
                        keyExtractor={(s) => String(s.id)}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.sessionListContent}
                        ListHeaderComponent={
                            <Pressable
                                onPress={chat.handleNewSession}
                                style={[styles.sessionChip, styles.sessionNewChip, { borderColor: colors.primary }]}
                            >
                                <Ionicons name="add" size={16} color={colors.primary} />
                            </Pressable>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => chat.switchSession(item.id)}
                                onLongPress={() => chat.handleDeleteSession(item)}
                                style={[
                                    styles.sessionChip,
                                    {
                                        backgroundColor: item.id === chat.activeSessionId ? colors.primary : colors.surface,
                                        borderColor: item.id === chat.activeSessionId ? colors.primary : colors.border,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.sessionChipText,
                                        { color: item.id === chat.activeSessionId ? "#fff" : colors.text },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.title}
                                </Text>
                            </Pressable>
                        )}
                    />
                    {!chat.isAtLatestSession && (
                        <Pressable
                            onPress={chat.handleNewSession}
                            style={[styles.scrollToLatestBtn, { backgroundColor: colors.primary }]}
                            hitSlop={8}
                        >
                            <Ionicons name="arrow-back" size={14} color="#fff" />
                            <Text style={styles.scrollToLatestText}>{t("chat.latest")}</Text>
                        </Pressable>
                    )}
                </View>

                {/* Messages */}
                <ScrollView
                    ref={chat.scrollRef}
                    style={styles.messageList}
                    contentContainerStyle={[
                        styles.messageListContent,
                        { paddingBottom: INPUT_BAR_HEIGHT + spacing.lg + (chat.keyboardHeight > 0 ? chat.keyboardHeight - visibleTabBarHeight : 0) },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {chat.messages.length === 0 && !chat.loading && (
                        <View style={styles.emptyState}>
                            <Ionicons name="sparkles-outline" size={32} color={colors.textTertiary} />
                            <Text style={styles.emptyStateText}>{t("chat.emptyHint")}</Text>
                        </View>
                    )}

                    {chat.messages.map((msg, idx) => (
                        <React.Fragment key={msg.id}>
                            <ChatBubble
                                message={msg}
                                colors={colors}
                                showActions={!chat.loading && idx === chat.lastAssistantActionIdx}
                                onCopy={chat.handleCopy}
                                onRetry={chat.handleRetry}
                            />
                            {msg.toolResultData &&
                                !msg.toolResultData.imported &&
                                !msg.toolResultData.dismissed && (
                                    <ToolResultContainer
                                        message={msg}
                                        colors={colors}
                                        onImport={chat.handleMealPlanImport}
                                        onDismiss={chat.handleMealPlanDismiss}
                                    />
                                )}
                        </React.Fragment>
                    ))}

                    {chat.loading && chat.streamingToolData && chat.streamingToolData.length > 0 && (
                        <MealPlanToolResult
                            entries={chat.streamingToolData}
                            colors={colors}
                            generating
                        />
                    )}

                    {chat.loading && !chat.streamingToolData && chat.streamingText ? (
                        <View style={[styles.bubble, styles.bubbleAssistant]}>
                            <Text style={[styles.bubbleText, { color: colors.text }]}>
                                {chat.streamingText}
                            </Text>
                            <View style={styles.streamingActions}>
                                <Pressable onPress={chat.handleStop} hitSlop={8} style={styles.actionBtn}>
                                    <Ionicons name="stop-circle-outline" size={18} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        </View>
                    ) : chat.loading && !chat.streamingToolData ? (
                        <View style={[styles.bubble, styles.bubbleAssistant, styles.loadingBubble]}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                {t("chat.thinking")}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <Pressable onPress={chat.handleStop} hitSlop={8} style={styles.actionBtn}>
                                <Ionicons name="stop-circle-outline" size={18} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                    ) : null}

                    {chat.pendingToolCall && !chat.loading && (
                        <ToolApprovalBanner
                            toolCall={chat.pendingToolCall}
                            colors={colors}
                            onApprove={chat.handleApproveTool}
                            onDeny={chat.handleDeclineTool}
                        />
                    )}
                </ScrollView>
            </BottomSheet>

            {/* Floating input bar */}
            <ChatInputBar
                inputRef={chat.inputRef}
                inputText={chat.inputText}
                onChangeText={chat.setInputText}
                loading={chat.loading}
                isOpen={isOpen}
                openSheet={openSheet}
                onSend={onSend}
                bottom={inputBottom}
                colors={colors}
            />
        </>
    );
}

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
        scrollToLatestBtn: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-end",
            gap: 4,
            marginHorizontal: spacing.md,
            marginTop: spacing.xs,
            marginBottom: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
        },
        scrollToLatestText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: "#fff",
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
            borderWidth: 1,
            borderColor: colors.border,
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
        streamingActions: {
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: spacing.xs,
        },
        actionBtn: {
            padding: 4,
        },
    });
}
