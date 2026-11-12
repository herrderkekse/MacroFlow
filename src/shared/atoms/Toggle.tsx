import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { Switch } from "react-native";

interface ToggleProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    /** Read out by screen readers when the switch has no visible label of its own. */
    label?: string;
}

/** The one on/off switch, tinted with the ink colour in both themes. */
export default function Toggle({ value, onValueChange, disabled, label }: ToggleProps) {
    const colors = useThemeColors();
    return (
        <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            accessibilityLabel={label}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={value ? colors.onPrimary : colors.textTertiary}
            ios_backgroundColor={colors.borderStrong}
        />
    );
}
