import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface CardProps {
    children: React.ReactNode;
    /** Set to false for cards whose rows manage their own padding (lists). */
    padded?: boolean;
    style?: StyleProp<ViewStyle>;
}

/** The one container: a surface with a hairline border, never a shadow. */
export default function Card({ children, padded = true, style }: CardProps) {
    const colors = useThemeColors();
    return (
        <View
            style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                padded && styles.padded,
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        overflow: "hidden",
    },
    padded: { padding: spacing.md },
});
