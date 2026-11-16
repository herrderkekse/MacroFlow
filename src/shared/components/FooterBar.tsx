import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FooterBarProps {
    children: React.ReactNode;
    /** Lay the children out side by side instead of stacked. */
    horizontal?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one place for a screen's main action: pinned to the bottom edge, above
 * the system navigation, separated from the content by a hairline. Forms put
 * "Save" here rather than at the end of their scroll content.
 */
export default function FooterBar({ children, horizontal = false, style }: FooterBarProps) {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    return (
        <View
            style={[
                styles.bar,
                horizontal && styles.horizontal,
                {
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                    paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        paddingHorizontal: screenPadding,
        paddingTop: spacing.sm + 4,
        gap: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    horizontal: { flexDirection: "row" },
});
