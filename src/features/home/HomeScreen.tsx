import { useThemeColors } from '@/src/utils/ThemeProvider';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
    const colors = useThemeColors();
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>MacroFlow</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Home — implement dashboard here</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
    },
});
