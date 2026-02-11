import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/ctx';

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
    const { notifications, clearNotifications } = useSession();

    const handleClear = () => {
        clearNotifications();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Notifications</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#1E1E1E" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.list}>
                        {notifications.length > 0 ? (
                            notifications.map((notif, index) => (
                                <View key={notif.id || index} style={styles.notificationItem}>
                                    <View style={styles.notifIcon}>
                                        <Ionicons name="receipt-outline" size={20} color="#FF8C69" />
                                    </View>
                                    <View style={styles.notifTextContainer}>
                                        <Text style={styles.notifMessage}>{notif.message}</Text>
                                        <Text style={styles.notifTime}>New update</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color="#CCC" />
                                <Text style={styles.emptyText}>No new notifications</Text>
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClear}
                    >
                        <Text style={styles.clearButtonText}>Clear All & Mark as Read</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '70%',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E1E1E',
    },
    closeButton: {
        padding: 4,
    },
    list: {
        flex: 1,
    },
    notificationItem: {
        flexDirection: 'row',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 12,
    },
    notifIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF5F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifTextContainer: {
        flex: 1,
    },
    notifMessage: {
        fontSize: 15,
        color: '#1E1E1E',
        lineHeight: 20,
        fontWeight: '500',
    },
    notifTime: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 16,
        color: '#AAA',
        marginTop: 12,
    },
    clearButton: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    clearButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
