import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LogScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Log</Text>
            <Text style={styles.subtitle}>Log food entries here.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#666' },
});
