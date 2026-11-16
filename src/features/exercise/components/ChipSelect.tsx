import Chip from "@/src/shared/atoms/Chip";
import ChipRow from "@/src/shared/components/ChipRow";
import React from "react";

interface ChipSelectProps<T extends string> {
    items: { key: T; label: string }[];
    selected: T | null;
    onSelect: (key: T | null) => void;
    horizontal?: boolean;
}

/**
 * An optional pick of at most one, as chips: tapping a chip selects it,
 * tapping the selected one clears the choice (null). A choice that must
 * always have an answer is a `SegmentedControl` instead. Scrolls sideways
 * unless `horizontal` is off, then wraps.
 */
export default function ChipSelect<T extends string>({ items, selected, onSelect, horizontal = true }: ChipSelectProps<T>) {
    return (
        <ChipRow scroll={horizontal}>
            {items.map((item) => (
                <Chip
                    key={item.key}
                    label={item.label}
                    selected={selected === item.key}
                    onPress={() => onSelect(selected === item.key ? null : item.key)}
                />
            ))}
        </ChipRow>
    );
}
