import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { EditGroupForm } from '@/components/groups/EditGroupForm';

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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
    const [groupBalances, setGroupBalances] = useState<Record<string, { pay: number; get: number }>>({});

    const calculateExpenseImpact = useCallback((expense: any) => {
        const splitBetween = expense.splitBetween || [];
        const splitDetails = expense.splitDetails || [];
        const isPaidByMe = expense.paidBy === currentUser?.id;
        const isInSplit = splitBetween.includes(currentUser?.id);
        let pay = 0;
        let get = 0;

        if (isPaidByMe) {
            if (expense.splitType === 'EQUAL') {
                const count = splitBetween.length;
                if (count > 0) {
                    const share = expense.amount / count;
                    get += isInSplit ? share * (count - 1) : expense.amount;
                }
            } else {
                splitDetails.forEach((detail: any) => {
                    if (detail.userId !== currentUser?.id) {
                        get += detail.amount || 0;
                    }
                });
            }
        } else if (isInSplit) {
            if (expense.splitType === 'EQUAL') {
                const count = splitBetween.length;
                if (count > 0) {
                    pay += expense.amount / count;
                }
            } else {
                const myDetail = splitDetails.find((detail: any) => detail.userId === currentUser?.id);
                if (myDetail) {
                    pay += myDetail.amount || 0;
                }
            }
        }

        return { pay, get };
    }, [currentUser?.id]);

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        const [groupsResult, expensesResult] = await Promise.all([
            api.getGroups(currentUser?.id),
            api.getExpenses(currentUser?.id),
        ]);

        if (groupsResult.success) {
            const sortedGroups = (groupsResult.data as Group[]).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setGroups(sortedGroups);
        }

        if (groupsResult.success && expensesResult.success) {
            const balances: Record<string, { pay: number; get: number }> = {};
            (groupsResult.data as Group[]).forEach(group => {
                balances[group.id] = { pay: 0, get: 0 };
            });

            expensesResult.data.forEach((expense: any) => {
                if (!expense.groupId || !balances[expense.groupId]) {
                    return;
                }

                const impact = calculateExpenseImpact(expense);
                balances[expense.groupId].pay += impact.pay;
                balances[expense.groupId].get += impact.get;
            });

            setGroupBalances(balances);
        }

        if (showLoading) setLoading(false);
    }, [calculateExpenseImpact, currentUser?.id]);

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
            return {
                ...group,
                memberCount: group.members.length,
                pay: groupBalances[group.id]?.pay || 0,
                get: groupBalances[group.id]?.get || 0,
            };
        });
    }, [groupBalances, groups]);

    const handleDeleteGroup = useCallback((group: Group) => {
        Alert.alert(
            'Delete Group',
            `Delete "${group.name}" and all expenses in this group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!currentUser?.id) {
                            Alert.alert('Error', 'Session expired. Please login again.');
                            return;
                        }
                        setDeletingGroupId(group.id);
                        const result = await api.deleteGroup(group.id, currentUser?.id);
                        setDeletingGroupId(null);

                        if (result.success) {
                            setGroups(prev => prev.filter(item => item.id !== group.id));
                            Alert.alert('Deleted', 'Group deleted successfully');
                            return;
                        }

                        Alert.alert('Error', result.message || 'Failed to delete group');
                    },
                },
            ]
        );
    }, [currentUser?.id]);

    const handleOpenEditGroup = useCallback((group: Group) => {
        setEditingGroup(group);
        setIsEditModalVisible(true);
    }, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
                        <IconSymbol size={20} name="chevron.left" color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Groups</Text>
                        <Text style={styles.headerSubtitle}>Manage your split groups</Text>
                    </View>
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
                {loading ? (
                    <ActivityIndicator size="small" color="#FF8C69" style={{ marginTop: 24 }} />
                ) : formattedGroups.length > 0 ? (
                    formattedGroups.map(group => (
                        <TouchableOpacity
                            key={group.id}
                            style={styles.groupCard}
                            activeOpacity={0.8}
                            onPress={() =>
                                router.push({
                                    pathname: '/(tabs)/group-expenses',
                                    params: {
                                        groupId: group.id,
                                        groupName: group.name,
                                        groupMembers: group.members.join(','),
                                    },
                                })
                            }
                        >
                            <View style={styles.groupTopRow}>
                                <Text style={styles.groupName}>{group.name}</Text>
                                <View style={styles.memberCountPill}>
                                    <IconSymbol size={12} name="person.2.fill" color="#FF8C69" />
                                    <Text style={styles.memberCountText}>{group.memberCount}</Text>
                                </View>
                            </View>
                            <View style={styles.balanceRow}>
                                <View style={styles.payPill}>
                                    <Text style={styles.payLabel}>Pay</Text>
                                    <Text style={styles.payValue}>₹{group.pay.toFixed(2)}</Text>
                                </View>
                                <View style={styles.getPill}>
                                    <Text style={styles.getLabel}>Get</Text>
                                    <Text style={styles.getValue}>₹{group.get.toFixed(2)}</Text>
                                </View>
                            </View>
                            <View style={styles.groupActions}>
                                <TouchableOpacity
                                    style={styles.editGroupButton}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        handleOpenEditGroup(group);
                                    }}
                                >
                                    <Text style={styles.editGroupButtonText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.deleteGroupButton, deletingGroupId === group.id && styles.disabledButton]}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        handleDeleteGroup(group);
                                    }}
                                    disabled={deletingGroupId === group.id}
                                >
                                    {deletingGroupId === group.id ? (
                                        <ActivityIndicator size="small" color="#D9534F" />
                                    ) : (
                                        <Text style={styles.deleteGroupButtonText}>Delete</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.addExpenseButton}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        router.push({
                                            pathname: '/(tabs)/add',
                                            params: {
                                                source: 'group',
                                                groupId: group.id,
                                                groupName: group.name,
                                                groupMembers: group.members.join(','),
                                            },
                                        });
                                    }}
                                >
                                    <IconSymbol size={14} name="plus.circle.fill" color="white" />
                                    <Text style={styles.addExpenseButtonText}>Add Expense</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
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

            <Modal
                visible={isEditModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setIsEditModalVisible(false);
                    setEditingGroup(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Group</Text>
                            <TouchableOpacity
                                style={styles.modalClose}
                                onPress={() => {
                                    setIsEditModalVisible(false);
                                    setEditingGroup(null);
                                }}
                            >
                                <IconSymbol size={20} name="xmark" color="#1E1E1E" />
                            </TouchableOpacity>
                        </View>
                        {editingGroup ? (
                            <EditGroupForm
                                group={editingGroup}
                                onCancel={() => {
                                    setIsEditModalVisible(false);
                                    setEditingGroup(null);
                                }}
                                onSuccess={() => {
                                    setIsEditModalVisible(false);
                                    setEditingGroup(null);
                                    fetchData(false);
                                }}
                            />
                        ) : null}
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
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
    balanceRow: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 10,
    },
    payPill: {
        flex: 1,
        backgroundColor: '#FFF3F3',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    getPill: {
        flex: 1,
        backgroundColor: '#EEF9EE',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    payLabel: {
        color: '#D9534F',
        fontSize: 12,
        fontWeight: '600',
    },
    getLabel: {
        color: '#2E7D32',
        fontSize: 12,
        fontWeight: '600',
    },
    payValue: {
        marginTop: 2,
        color: '#D9534F',
        fontSize: 14,
        fontWeight: '700',
    },
    getValue: {
        marginTop: 2,
        color: '#2E7D32',
        fontSize: 14,
        fontWeight: '700',
    },
    groupActions: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    deleteGroupButton: {
        borderColor: '#FFD9D7',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FFF5F5',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 76,
    },
    editGroupButton: {
        borderColor: '#FFE6D9',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FFF8F3',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 64,
    },
    editGroupButtonText: {
        color: '#FF8C69',
        fontSize: 13,
        fontWeight: '700',
    },
    deleteGroupButtonText: {
        color: '#D9534F',
        fontSize: 13,
        fontWeight: '700',
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
    disabledButton: {
        opacity: 0.7,
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
