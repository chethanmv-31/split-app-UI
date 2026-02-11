import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/services/api';
import { useSession } from '@/ctx';
import { CreateGroupForm } from '@/components/groups/CreateGroupForm';

type Group = {
    id: string;
    name: string;
    createdBy: string;
    members: string[];
    createdAt: string;
};

export default function GroupsScreen() {
    const router = useRouter();
    const { session } = useSession();
    const currentUser = session ? JSON.parse(session) : null;

    const [groups, setGroups] = useState<Group[]>([]);
    const [usersById, setUsersById] = useState<Record<string, { id: string; name: string }>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        const [groupsResult, usersResult] = await Promise.all([
            api.getGroups(currentUser?.id),
            api.getUsers(),
        ]);

        if (groupsResult.success) {
            const sortedGroups = (groupsResult.data as Group[]).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setGroups(sortedGroups);
        }

        if (usersResult.success) {
            const map: Record<string, { id: string; name: string }> = {};
            usersResult.data.forEach((user: { id: string; name: string }) => {
                map[user.id] = user;
            });
            setUsersById(map);
        }

        if (showLoading) setLoading(false);
    }, [currentUser?.id]);

    useFocusEffect(
        useCallback(() => {
            fetchData(groups.length === 0);
        }, [fetchData, groups.length])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData(false);
        setRefreshing(false);
    }, [fetchData]);

    const formattedGroups = useMemo(() => {
        return groups.map(group => {
            const memberNames = group.members
                .map(memberId => usersById[memberId]?.name)
                .filter(Boolean);

            return {
                ...group,
                memberCount: group.members.length,
                memberNames,
                createdLabel: new Date(group.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
            };
        });
    }, [groups, usersById]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Groups</Text>
                    <Text style={styles.headerSubtitle}>Manage your split groups</Text>
                </View>
                <TouchableOpacity style={styles.createHeaderButton} onPress={() => setIsCreateModalVisible(true)}>
                    <IconSymbol size={20} name="plus" color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />
                }
            >
                <TouchableOpacity style={styles.createCard} onPress={() => setIsCreateModalVisible(true)}>
                    <View style={styles.createCardIcon}>
                        <IconSymbol size={22} name="person.3.fill" color="#FF8C69" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.createCardTitle}>Create New Group</Text>
                        <Text style={styles.createCardSub}>Tap to add a group without leaving this screen.</Text>
                    </View>
                    <IconSymbol size={18} name="chevron.right" color="#FF8C69" />
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="small" color="#FF8C69" style={{ marginTop: 24 }} />
                ) : formattedGroups.length > 0 ? (
                    formattedGroups.map(group => (
                        <View key={group.id} style={styles.groupCard}>
                            <View style={styles.groupTopRow}>
                                <Text style={styles.groupName}>{group.name}</Text>
                                <View style={styles.memberCountPill}>
                                    <IconSymbol size={12} name="person.2.fill" color="#FF8C69" />
                                    <Text style={styles.memberCountText}>{group.memberCount}</Text>
                                </View>
                            </View>
                            <Text style={styles.createdAt}>Created {group.createdLabel}</Text>
                            <Text style={styles.membersLabel} numberOfLines={2}>
                                {group.memberNames.join(', ')}
                            </Text>
                            <View style={styles.groupActions}>
                                <TouchableOpacity
                                    style={styles.addExpenseButton}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/(tabs)/add',
                                            params: {
                                                groupId: group.id,
                                                groupName: group.name,
                                                groupMembers: group.members.join(','),
                                            },
                                        })
                                    }
                                >
                                    <IconSymbol size={14} name="plus.circle.fill" color="white" />
                                    <Text style={styles.addExpenseButtonText}>Add Expense</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No groups yet</Text>
                        <Text style={styles.emptySub}>Create your first group to start splitting with friends.</Text>
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={isCreateModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Group</Text>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setIsCreateModalVisible(false)}>
                                <IconSymbol size={20} name="xmark" color="#1E1E1E" />
                            </TouchableOpacity>
                        </View>
                        <CreateGroupForm
                            onCancel={() => setIsCreateModalVisible(false)}
                            onSuccess={() => {
                                setIsCreateModalVisible(false);
                                fetchData(false);
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FF9F6A',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: 'white',
    },
    headerSubtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
    },
    createHeaderButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    content: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 22,
    },
    createCard: {
        backgroundColor: 'white',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#FFE5DB',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    createCardIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF0ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    createCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    createCardSub: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    groupCard: {
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
    },
    groupTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E1E1E',
        flex: 1,
        marginRight: 10,
    },
    memberCountPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0ED',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    memberCountText: {
        marginLeft: 4,
        color: '#FF8C69',
        fontSize: 12,
        fontWeight: '700',
    },
    createdAt: {
        fontSize: 12,
        color: '#888',
        marginTop: 8,
    },
    membersLabel: {
        fontSize: 13,
        color: '#555',
        marginTop: 8,
    },
    groupActions: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    addExpenseButton: {
        backgroundColor: '#FF8C69',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addExpenseButtonText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyState: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    emptySub: {
        marginTop: 6,
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: 'white',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F3F3',
    },
});
