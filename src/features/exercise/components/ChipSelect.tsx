import Chip from "@/src/shared/atoms/Chip";
import { spacing } from "@/src/utils/theme";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

interface ChipSelectProps<T extends string> {
    items: { key: T; label: string }[];
    selected: T | null;
    onSelect: (key: T | null) => void;
    noneLabel?: string;
    horizontal?: boolean;
}

/** A single-choice row of chips; scrolls sideways unless `horizontal` is off. */
export default function ChipSelect<T extends string>({
    items, selected, onSelect, noneLabel, horizontal = true,
}: ChipSelectProps<T>) {
    const chips = (
        <>
            {noneLabel != null && (
                <Chip label={noneLabel} selected={selected === null} onPress={() => onSelect(null)} />
            )}
            {items.map((item) => (
                <Chip
                    key={item.key}
                    label={item.label}
                    selected={selected === item.key}
                    onPress={() => onSelect(item.key)}
                />
            ))}
        </>
    );

    if (horizontal) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                keyboardShouldPersistTaps="handled"
            >
                {chips}
            </ScrollView>
        );
    }

    return <View style={[styles.row, styles.wrap]}>{chips}</View>;
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.sm },
    wrap: { flexWrap: "wrap" },
});
