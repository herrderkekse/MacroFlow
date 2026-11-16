import { floatingShadow, borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View, type TextInput as TextInputType } from "react-native";

const INPUT_BAR_HEIGHT = 52;

interface ChatInputBarProps {
    inputRef: React.RefObject<TextInputType | null>;
    inputText: string;
    onChangeText: (text: string) => void;
    loading: boolean;
    isOpen: boolean;
    openSheet: () => void;
    onSend: () => void;
    bottom: number;
    colors: ThemeColors;
}

export default function ChatInputBar({
    inputRef,
    inputText,
    onChangeText,
    loading,
    isOpen,
    openSheet,
    onSend,
    bottom,
    colors,
}: ChatInputBarProps) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.inputBar, { bottom }]}>
            <Pressable style={styles.inputTouchArea} onPress={() => { if (!isOpen) openSheet(); }}>
                <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={isOpen ? colors.text : colors.textTertiary}
                />
                <TextInput
                    ref={inputRef}
                    style={styles.inputText}
                    value={inputText}
                    onChangeText={onChangeText}
                    placeholder={t("chat.placeholder")}
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.textSecondary}
                    onFocus={() => { if (!isOpen) openSheet(); }}
                    onSubmitEditing={onSend}
                    blurOnSubmit={false}
                    editable={!loading}
                    returnKeyType="send"
                />
            </Pressable>
            {(inputText.trim().length > 0 || isOpen) && (
                <Pressable
                    onPress={onSend}
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
                    <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
                </Pressable>
            )}
        </View>
    );
}

export { INPUT_BAR_HEIGHT };

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        inputBar: {
            position: "absolute",
            left: spacing.md,
            right: spacing.md,
            height: INPUT_BAR_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs + 2,
            ...floatingShadow,
            elevation: 12,
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
