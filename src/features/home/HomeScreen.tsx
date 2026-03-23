import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>MacroFlow</Text>
            <Text style={styles.subtitle}>Home — implement dashboard here</Text>
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
        color: '#666',
    },
});
