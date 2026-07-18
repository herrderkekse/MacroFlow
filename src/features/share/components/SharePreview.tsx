// Compact "what's inside this share" summary rendered in the import screen.

import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FetchedShare } from "../services/shareClient";
import type {
    FoodSharePayload,
    LogSharePayload,
    RecipeSharePayload,
} from "../services/sharePayloads";

interface SharePreviewProps {
    share: FetchedShare;
    colors: ThemeColors;
}

const KIND_ICONS = {
    food: "fast-food-outline",
    recipe: "book-outline",
    log: "list-outline",
} as const;

export default function SharePreview({ share, colors }: SharePreviewProps) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { title, lines } = useMemo(() => summarize(share, t), [share, t]);

    return (
        <View style={styles.card}>
            <View style={styles.titleRow}>
                <Ionicons
                    name={KIND_ICONS[share.kind] ?? "help-circle-outline"}
                    size={20}
                    color={colors.primary}
                />
                <Text style={styles.kindLabel}>{t(`share.kind_${share.kind}`)}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
                {title}
            </Text>
            {lines.map((line, i) => (
                <Text key={i} style={styles.line} numberOfLines={1}>
                    {line}
                </Text>
            ))}
        </View>
    );
}

function summarize(
    share: FetchedShare,
    t: (key: string, opts?: any) => string,
): { title: string; lines: string[] } {
    switch (share.kind) {
        case "food": {
            const p = share.payload as FoodSharePayload;
            return {
                title: p?.food?.name ?? t("common.unknown"),
                lines: [
                    t("templates.calPer100g", { cal: Math.round(Number(p?.food?.calories_per_100g ?? 0)) }),
                ],
            };
        }
        case "recipe": {
            const p = share.payload as RecipeSharePayload;
            const items = Array.isArray(p?.items) ? p.items : [];
            return {
                title: p?.name ?? t("common.unknown"),
                lines: [
                    t("common.itemCount", { count: items.length }),
                    ...items.slice(0, 4).map((item) => `· ${item?.food?.name ?? t("common.unknown")}`),
                    ...(items.length > 4 ? [t("share.moreItems", { count: items.length - 4 })] : []),
                ],
            };
        }
        case "log": {
            const p = share.payload as LogSharePayload;
            const items = Array.isArray(p?.items) ? p.items : [];
            const names = items.map((item) =>
                item?.type === "recipe"
                    ? (item.recipe?.name ?? t("common.unknown"))
                    : (item?.food?.name ?? t("common.unknown")),
            );
            return {
                title: t("common.itemCount", { count: items.length }),
                lines: [
                    ...names.slice(0, 5).map((name) => `· ${name}`),
                    ...(names.length > 5 ? [t("share.moreItems", { count: names.length - 5 })] : []),
                ],
            };
        }
        default:
            return { title: t("common.unknown"), lines: [] };
    }
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.background,
            borderRadius: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.xs,
        },
        kindLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.xs,
        },
        line: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginTop: 2,
        },
    });
}
