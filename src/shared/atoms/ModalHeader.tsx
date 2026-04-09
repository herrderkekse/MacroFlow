import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ModalHeaderProps {
    title: string;
    onClose: () => void;
}

export default function ModalHeader({ title, onClose }: ModalHeaderProps) {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors, insetsTop: number) {
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: insetsTop + spacing.md,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
    });
}
