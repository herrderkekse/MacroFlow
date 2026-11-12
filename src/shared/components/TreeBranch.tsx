import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { StyleSheet, View } from "react-native";

interface TreeBranchProps {
    /** The last child ends the line instead of running on to the next one. */
    isLast: boolean;
}

/**
 * The right-angle line in front of a child row (a logged recipe's
 * ingredients, a recipe's variants), joining it to the row above. Stretches
 * to the row's height; give it the row's leading slot.
 */
export default function TreeBranch({ isLast }: TreeBranchProps) {
    const colors = useThemeColors();
    const line = { borderColor: colors.borderStrong };
    return (
        <View style={styles.tree}>
            <View style={[styles.elbow, line]} />
            {!isLast && <View style={[styles.stem, line]} />}
        </View>
    );
}

const styles = StyleSheet.create({
    tree: { width: 16, alignSelf: "stretch" },
    elbow: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "50%",
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderBottomLeftRadius: 5,
    },
    stem: { position: "absolute", left: 0, top: "50%", bottom: 0, borderLeftWidth: 1 },
});
