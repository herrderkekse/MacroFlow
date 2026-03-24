import { useThemeColors } from '@/src/utils/ThemeProvider';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
    const colors = useThemeColors();
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>History</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Browse past days and entries.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
    subtitle: { fontSize: 14 },
});
