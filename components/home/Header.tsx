import React from 'react';
import { View, Text, StyleSheet, Image, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/ctx';
import { NotificationsModal } from './NotificationsModal';
import { useRouter } from 'expo-router';

export function Header() {
    const { session, signOut, hasNotifications } = useSession();
    const router = useRouter();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [isProfileMenuVisible, setIsProfileMenuVisible] = React.useState(false);

    const user = React.useMemo(() => {
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch {
            return null;
        }
    }, [session]);

    const avatarSource = React.useMemo(
        () => ({ uri: user?.avatar || `https://i.pravatar.cc/150?u=${user?.id ?? 'guest'}` }),
        [user?.avatar, user?.id]
    );

    const handleViewProfile = () => {
        setIsProfileMenuVisible(false);
        router.push('/(tabs)/profile');
    };

    const handleLogout = () => {
        setIsProfileMenuVisible(false);
        signOut();
    };

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
                    onPress={() => {
                        setIsProfileMenuVisible(false);
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="notifications" size={20} color="#FF8C69" />
                    {hasNotifications && <View style={styles.badge} />}
                </TouchableOpacity>
                <View style={styles.profileMenuContainer}>
                    <TouchableOpacity onPress={() => setIsProfileMenuVisible((prev) => !prev)}>
                        <Image
                            source={avatarSource}
                            style={styles.avatar}
                            fadeDuration={0}
                        />
                    </TouchableOpacity>
                    {isProfileMenuVisible && (
                        <View style={styles.profileMenu}>
                            <TouchableOpacity style={styles.menuItem} onPress={handleViewProfile}>
                                <Text style={styles.menuItemText}>View Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                                <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
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
        position: 'relative',
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
    profileMenuContainer: {
        position: 'relative',
    },
    profileMenu: {
        position: 'absolute',
        top: 48,
        right: 0,
        minWidth: 140,
        borderRadius: 10,
        backgroundColor: 'white',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEE',
        zIndex: 10,
    },
    menuItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    menuItemText: {
        fontSize: 14,
        color: '#222',
        fontWeight: '600',
    },
    logoutText: {
        color: '#D93025',
    },
});
