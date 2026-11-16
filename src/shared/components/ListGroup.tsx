import Card from "@/src/shared/atoms/Card";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface ListGroupProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** A card of rows separated by inset hairlines. Skips falsy children. */
export default function ListGroup({ children, style }: ListGroupProps) {
    const colors = useThemeColors();
    const rows = React.Children.toArray(children).filter(Boolean);

    return (
        <Card padded={false} style={style}>
            {rows.map((row, index) => (
                <React.Fragment key={index}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    {row}
                </React.Fragment>
            ))}
        </Card>
    );
}

const styles = StyleSheet.create({
    divider: { height: StyleSheet.hairlineWidth, marginLeft: screenPadding },
});
