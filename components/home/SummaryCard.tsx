import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SummaryCardProps {
    title: string;
    amount: string;
    type: 'owe' | 'owed';
}

export function SummaryCard({ title, amount, type }: SummaryCardProps) {
    const isOwe = type === 'owe';

    return (
        <View style={[styles.card, isOwe ? styles.oweCard : styles.owedCard]}>
            <View style={styles.iconContainer}>
                <Ionicons
                    name={isOwe ? "arrow-up-circle" : "arrow-down-circle"}
                    size={32}
                    color={isOwe ? "#FF5252" : "#00C853"}
                />
            </View>
            <View style={styles.textContainer}>
                <Text
                    style={[styles.amount, isOwe ? styles.oweAmountText : styles.owedAmountText]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                >
                    {amount}
                </Text>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 16,
        paddingBottom: 20,
        flex: 1,
        height: 140,
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: '#333',
        position: 'relative',
        overflow: 'hidden',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingRight: 40, // Space for the absolute icon
    },
    oweCard: {
        borderBottomWidth: 4,
        borderBottomColor: '#FF5252',
    },
    owedCard: {
        borderBottomWidth: 4,
        borderBottomColor: '#00C853',
    },
    amount: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    oweAmountText: {
        color: '#FFCDD2',
    },
    owedAmountText: {
        color: '#C8E6C9',
    },
    title: {
        color: '#AAAAAA',
        fontSize: 14,
    },
    iconContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 4,
    },
});
