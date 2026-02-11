import React from 'react';
import { View, Text, StyleSheet, Image, Platform, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/ctx';
import { NotificationsModal } from './NotificationsModal';

export function Header() {
    const { signOut, hasNotifications, clearNotifications } = useSession();
    const [modalVisible, setModalVisible] = React.useState(false);
    return (
        <View style={styles.container}>
            {/* Logo Area */}
            <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                    <View style={[styles.circle, styles.circleLeft]} />
                    <View style={[styles.circle, styles.circleRight]} />
                </View>
                <Text style={styles.appName}>Splitty</Text>
            </View>

            {/* Right Actions */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.notificationButton}
                    onPress={() => setModalVisible(true)}
                >
                    <Ionicons name="notifications" size={20} color="#FF8C69" />
                    {hasNotifications && <View style={styles.badge} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Alert.alert('Logout', 'Are you sure you want to logout?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Logout', style: 'destructive', onPress: signOut }
                    ]);
                }}>
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
                        style={styles.avatar}
                    />
                </TouchableOpacity>
            </View>

            <NotificationsModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 10,
        paddingBottom: 20,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logoIcon: {
        width: 24,
        height: 24,
        position: 'relative',
    },
    circle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        position: 'absolute',
        backgroundColor: 'white',
    },
    circleLeft: {
        top: 0,
        left: 0,
    },
    circleRight: {
        bottom: 0,
        right: 0,
    },
    appName: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    notificationButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'white',
    },
    badge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF5252',
        borderWidth: 2,
        borderColor: '#1E1E1E',
    },
});
