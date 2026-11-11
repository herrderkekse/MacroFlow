import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import IconButton from "@/src/shared/atoms/IconButton";
import BottomSheet, { type BottomSheetRef } from "@/src/shared/components/BottomSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
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
    type TextInput,
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
    const sessionListRef = useRef<FlatList>(null);
    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);
    const [isOpen, setIsOpen] = useState(false);

    const chat = useChatSession({ onVisibilityChange, onDataChanged, sessionListRef, scrollRef, inputRef });

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
                    <Text style={styles.chatHeaderText}>{t("chat.title")}</Text>
                    <IconButton icon="add" size="sm" label={t("chat.newSession")} onPress={chat.handleNewSession} />
                    <IconButton icon="chevron-down" size="sm" variant="tonal" label={t("common.close")} onPress={closeSheet} />
                </View>

                {/* Session selector */}
                {chat.sessions.length > 0 && (
                    <View style={styles.sessionBar}>
                        <FlatList
                            ref={sessionListRef}
                            horizontal
                            data={chat.sessions}
                            keyExtractor={(s) => String(s.id)}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.sessionListContent}
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() => chat.switchSession(item.id)}
                                    onLongPress={() => chat.handleDeleteSession(item)}
                                >
                                    <View pointerEvents="none">
                                        <Chip
                                            label={item.title}
                                            selected={item.id === chat.activeSessionId}
                                            style={styles.sessionChip}
                                        />
                                    </View>
                                </Pressable>
                            )}
                        />
                        {!chat.isAtLatestSession && (
                            <Button
                                title={t("chat.latest")}
                                size="sm"
                                variant="ghost"
                                icon={<Ionicons name="arrow-back" size={14} color={colors.text} />}
                                onPress={chat.handleNewSession}
                                style={styles.scrollToLatestBtn}
                            />
                        )}
                    </View>
                )}

                {/* Messages */}
                <ScrollView
                    ref={scrollRef}
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
                                <IconButton icon="stop-circle-outline" size="sm" color={colors.textSecondary} label={t("chat.stop")} onPress={chat.handleStop} />
                            </View>
                        </View>
                    ) : chat.loading && !chat.streamingToolData ? (
                        <View style={[styles.bubble, styles.bubbleAssistant, styles.loadingBubble]}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                {t("chat.thinking")}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <IconButton icon="stop-circle-outline" size="sm" color={colors.textSecondary} label={t("chat.stop")} onPress={chat.handleStop} />
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
                inputRef={inputRef}
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
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
        },
        chatHeaderText: {
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: "700",
            letterSpacing: -0.2,
            color: colors.text,
        },
        sessionBar: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            paddingBottom: spacing.sm,
        },
        sessionListContent: { paddingHorizontal: screenPadding, gap: spacing.sm },
        sessionChip: { maxWidth: 180 },
        scrollToLatestBtn: { alignSelf: "flex-end", marginRight: spacing.sm },
        messageList: { flex: 1 },
        messageListContent: { padding: screenPadding },
        emptyState: {
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 60,
            gap: spacing.sm,
        },
        emptyStateText: {
            fontSize: fontSize.sm,
            lineHeight: 20,
            color: colors.textSecondary,
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        bubbleText: { fontSize: fontSize.md, lineHeight: 22 },
        loadingBubble: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        loadingText: { fontSize: fontSize.sm },
        streamingActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.xs },
    });
}
