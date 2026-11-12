import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

/** The round check in front of a row while selecting entries. */
export default function SelectCheck({ checked }: { checked: boolean }) {
    const colors = useThemeColors();
    return (
        <View
            style={[
                styles.check,
                checked
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
        >
            {checked && <Ionicons name="checkmark" size={13} color={colors.onPrimary} />}
        </View>
    );
}

const styles = StyleSheet.create({
    check: {
        width: 21,
        height: 21,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
