import type { IconName } from "@/src/shared/atoms/IconButton";
import AddPlaceholder from "@/src/shared/components/AddPlaceholder";
import SectionHeader, { type SectionHeaderProps } from "@/src/shared/components/SectionHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface SectionCardProps extends Omit<SectionHeaderProps, "style" | "onLayout"> {
    /** Shown instead of the card while there is nothing in it. */
    empty?: { icon: IconName; label: string; onPress?: () => void };
    /** Draws the selection outline. */
    selected?: boolean;
    /** Leaves the children unframed (e.g. a row of photo tiles). */
    bare?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one titled group on a day or detail page: a `SectionHeader` label that
 * doubles as the add button, then a card of rows — or, while empty, an
 * `AddPlaceholder` that adds too. The log's meals, weight, training and
 * photos all share it.
 */
export default function SectionCard({ empty, selected = false, bare = false, children, style, ...header }: SectionCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasBody = React.Children.toArray(children).length > 0;

    return (
        <View style={style}>
            <SectionHeader {...header} />
            {hasBody ? (
                bare ? children : <View style={[styles.card, selected && styles.selected]}>{children}</View>
            ) : empty ? (
                <AddPlaceholder icon={empty.icon} label={empty.label} onPress={empty.onPress ?? header.onAdd} />
            ) : null}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
        },
        selected: { borderColor: colors.primary },
    });
}
