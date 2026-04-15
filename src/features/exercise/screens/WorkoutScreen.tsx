import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import { StyleSheet, Text, View } from "react-native";

export default function WorkoutScreen() {
    const colors = useThemeColors();

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
                Workout — coming soon
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    placeholder: { fontSize: fontSize.lg },
});
