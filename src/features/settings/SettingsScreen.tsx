import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Set goals and preferences.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#666' },
});
