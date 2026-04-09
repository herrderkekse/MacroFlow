import { fontSize } from "@/src/utils/theme";
import { StyleSheet, Text, View } from "react-native";

interface MacroLabelProps {
    label: string;
    value: number;
    color: string;
    textColor: string;
}

export default function MacroLabel({ label, value, color, textColor }: MacroLabelProps) {
    return (
        <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color }]}>{value.toFixed(1)}g</Text>
            <Text style={[styles.macroLabel, { color: textColor }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    macroItem: { alignItems: "center" },
    macroValue: { fontSize: fontSize.md, fontWeight: "600" },
    macroLabel: { fontSize: fontSize.xs },
});
