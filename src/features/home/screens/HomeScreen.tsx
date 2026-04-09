import { useThemeColors } from '@/src/shared/providers/ThemeProvider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>MacroFlow</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("home.subtitle")}</Text>
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
