import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import type { CropAspectKey } from "../helpers/cropGeometry";

interface CropAspectButtonProps {
    aspect: CropAspectKey;
    onPress: () => void;
}

/** The crop's shape, in the header while trimming; opens the choice of shapes. */
export default function CropAspectButton({ aspect, onPress }: CropAspectButtonProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const label = aspect === "original" ? t("exercise.setVideo.aspectOriginal") : aspect;

    return (
        <Pressable
            onPress={onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("exercise.setVideo.aspectLabel", { aspect: label })}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
            <Ionicons name="crop" size={16} color={colors.text} />
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        pill: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            height: 36,
            paddingHorizontal: spacing.sm + 2,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.borderStrong,
        },
        pressed: { opacity: 0.6 },
        label: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600", fontVariant: ["tabular-nums"] },
    });
}
