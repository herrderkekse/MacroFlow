import React, { useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    LayoutAnimation,
    Platform,
    UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import type { Goals } from "@/src/db/queries";

if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Totals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface DailyProgressBarProps {
    totals: Totals;
    goals: Goals;
}

function ProgressRow({
    label,
    current,
    goal,
    color,
    unit,
}: {
    label: string;
    current: number;
    goal: number;
    color: string;
    unit: string;
}) {
    const ratio = goal > 0 ? Math.min(current / goal, 1) : 0;

    return (
        <View style={rowStyles.container}>
            <View style={rowStyles.labelRow}>
                <Text style={[rowStyles.label, { color }]}>{label}</Text>
                <Text style={rowStyles.values}>
                    {Math.round(current)}{" "}
                    <Text style={rowStyles.separator}>/</Text>{" "}
                    {Math.round(goal)} {unit}
                </Text>
            </View>
            <View style={rowStyles.track}>
                <View
                    style={[
                        rowStyles.fill,
                        {
                            backgroundColor: color,
                            width: `${ratio * 100}%`,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const rowStyles = StyleSheet.create({
    container: { marginTop: spacing.sm },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    label: {
        fontSize: fontSize.xs,
        fontWeight: "600",
    },
    values: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    separator: {
        color: colors.textTertiary,
    },
    track: {
        height: 6,
        backgroundColor: colors.border,
        borderRadius: 3,
        overflow: "hidden",
    },
    fill: {
        height: 6,
        borderRadius: 3,
    },
});

export default function DailyProgressBar({
    totals,
    goals,
}: DailyProgressBarProps) {
    const [expanded, setExpanded] = useState(false);

    const calRatio =
        goals.calories > 0 ? Math.min(totals.calories / goals.calories, 1) : 0;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    }

    return (
        <Pressable style={styles.container} onPress={toggle}>
            {/* Calorie bar – always visible */}
            <View style={styles.headerRow}>
                <Text style={styles.calorieText}>
                    {Math.round(totals.calories)}{" "}
                    <Text style={styles.goalText}>
                        / {Math.round(goals.calories)} kcal
                    </Text>
                </Text>
                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                />
            </View>
            <View style={styles.track}>
                <View
                    style={[
                        styles.fill,
                        {
                            backgroundColor: colors.calories,
                            width: `${calRatio * 100}%`,
                        },
                    ]}
                />
            </View>

            {/* Expanded macro bars */}
            {expanded && (
                <View style={styles.macros}>
                    <ProgressRow
                        label="Protein"
                        current={totals.protein}
                        goal={goals.protein}
                        color={colors.protein}
                        unit="g"
                    />
                    <ProgressRow
                        label="Carbs"
                        current={totals.carbs}
                        goal={goals.carbs}
                        color={colors.carbs}
                        unit="g"
                    />
                    <ProgressRow
                        label="Fat"
                        current={totals.fat}
                        goal={goals.fat}
                        color={colors.fat}
                        unit="g"
                    />
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    calorieText: {
        fontSize: fontSize.md,
        fontWeight: "600",
        color: colors.text,
    },
    goalText: {
        fontWeight: "400",
        color: colors.textSecondary,
    },
    track: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: "hidden",
    },
    fill: {
        height: 8,
        borderRadius: 4,
    },
    macros: {
        marginTop: spacing.xs,
    },
});
