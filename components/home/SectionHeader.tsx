import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
    title: string;
    actionText?: string;
    onAction?: () => void;
    textColor?: string;
}

export function SectionHeader({ title, actionText = 'View All', onAction, textColor = 'white' }: SectionHeaderProps) {
    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            {actionText && (
                <TouchableOpacity onPress={onAction}>
                    <Text style={styles.action}>{actionText}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
        marginTop: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    action: {
        color: 'white',
        opacity: 0.8,
        fontSize: 14,
    },
});
