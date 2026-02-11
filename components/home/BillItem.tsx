import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

interface BillItemProps {
    title: string;
    date: string;
    totalAmount: string;
    userAmount: string;
    isOwed: boolean; // true means get, false means pay
    avatarGroup: string[]; // URLs for avatars
    icon: string; // URL or local asset for the bill icon
    iconBackgroundColor?: string;
    isHighlight?: boolean;
    groupName?: string;
    onPress?: () => void;
}

export function BillItem({ title, date, totalAmount, userAmount, isOwed, avatarGroup, icon, iconBackgroundColor = '#E0F7FA', isHighlight, groupName, onPress }: BillItemProps) {
    return (
        <TouchableOpacity
            style={[styles.container, isHighlight && styles.highlightContainer]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.topRow}>
                <View style={styles.leftContent}>
                    <View style={[styles.iconBox, { backgroundColor: iconBackgroundColor }]}>
                        <Image source={{ uri: icon }} style={styles.icon} />
                    </View>
                    <View>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>{title}</Text>
                            {isHighlight && (
                                <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>NEW</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.date}>{date}</Text>
                            {groupName ? (
                                <View style={styles.groupBadge}>
                                    <Text style={styles.groupBadgeText}>{groupName}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>
                <Text style={styles.totalAmount}>{totalAmount}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.bottomRow}>
                <View style={styles.avatars}>
                    {avatarGroup.map((url, index) => (
                        <Image
                            key={index}
                            source={{ uri: url }}
                            style={[styles.avatar, { marginLeft: index > 0 ? -12 : 0 }]}
                        />
                    ))}
                </View>
                <View style={[styles.statusBadge, isOwed ? styles.owedBadge : styles.oweBadge]}>
                    <Text style={[styles.statusText, isOwed ? styles.owedText : styles.oweText]}>
                        {isOwed ? 'Get' : 'Pay'}
                    </Text>
                    <Text style={[styles.statusAmount, isOwed ? styles.owedText : styles.oweText]}>
                        {userAmount}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 20,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 6,
    },
    date: {
        fontSize: 12,
        color: '#888',
    },
    groupBadge: {
        backgroundColor: '#F2F4F7',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        maxWidth: 160,
    },
    groupBadgeText: {
        fontSize: 10,
        color: '#5F6672',
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E1E1E',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginBottom: 12,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    avatars: {
        flexDirection: 'row',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'white',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    owedBadge: {
        backgroundColor: '#E0F8E0',
    },
    oweBadge: {
        backgroundColor: '#FFF0F0',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
    },
    statusAmount: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    owedText: {
        color: '#2E7D32',
    },
    oweText: {
        color: '#D32F2F',
    },
    highlightContainer: {
        backgroundColor: '#FFF5F2',
        borderWidth: 1,
        borderColor: '#FF8C69',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    newBadge: {
        backgroundColor: '#FF5252',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBadgeText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
    },
});
