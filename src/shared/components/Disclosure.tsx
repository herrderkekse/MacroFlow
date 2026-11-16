import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface DisclosureProps {
    title: string;
    icon?: IconName;
    /** Controlled open state. Leave out to let the component manage it. */
    open?: boolean;
    onToggle?: (open: boolean) => void;
    defaultOpen?: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one way to tuck optional or advanced fields out of the way: a quiet
 * row that expands in place. Forms show what most entries need and put the
 * rest behind one of these.
 */
export default function Disclosure({ title, icon, open, onToggle, defaultOpen = false, children, style }: DisclosureProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = open ?? internalOpen;

    function toggle() {
        setInternalOpen(!isOpen);
        onToggle?.(!isOpen);
    }

    return (
        <View style={style}>
            <Pressable
                onPress={toggle}
                style={({ pressed }) => [styles.header, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
            >
                {icon && <Ionicons name={icon} size={16} color={colors.textSecondary} />}
                <Text style={styles.title}>{title}</Text>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
            </Pressable>
            {isOpen && <View style={styles.body}>{children}</View>}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 44,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        pressed: { opacity: 0.6 },
        title: { flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
        body: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
    });
}
