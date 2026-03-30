import { useThemeColors } from '@/src/utils/ThemeProvider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t("history.title")}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("history.subtitle")}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
    subtitle: { fontSize: 14 },
});
