import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationToastProps {
    message: string;
    onHide: () => void;
}

export function NotificationToast({ message, onHide }: NotificationToastProps) {
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        // Slide in
        Animated.spring(slideAnim, {
            toValue: 50,
            useNativeDriver: true,
            bounciness: 10,
        }).start();

        // Hide after 3 seconds
        const timer = setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start(() => onHide());
        }, 3000);

        return () => clearTimeout(timer);
    }, [slideAnim, onHide]);

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.content}>
                <Ionicons name="notifications-circle" size={24} color="#FF8C69" />
                <Text style={styles.message} numberOfLines={2}>{message}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 9999,
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    message: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
});
