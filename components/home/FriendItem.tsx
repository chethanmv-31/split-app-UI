import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FriendItemProps {
    name: string;
    status: string;
    amount?: string;
    avatar: string;
    isOwed?: boolean;
    onPress?: () => void;
}

export function FriendItem({ name, status, amount, avatar, isOwed, onPress }: FriendItemProps) {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.left}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.status}>
                        {status} <Text style={[styles.amount, { color: isOwed ? '#2E7D32' : '#D32F2F' }]}>{amount}</Text>
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#1E1E1E" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 20,
        marginBottom: 10,
        marginHorizontal: 20,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    status: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    amount: {
        fontWeight: 'bold',
    },
});
