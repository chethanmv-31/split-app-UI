import React, { useState, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/home/SectionHeader';
import { BillItem } from '@/components/home/BillItem';
import { NotificationToast } from '@/components/home/NotificationToast';
import { api } from '../../services/api';
import { useSession } from '../../ctx';
import { useFocusEffect, useRouter } from 'expo-router';

export default function HistoryScreen() {
    const router = useRouter();
    const { session, addNotification, notifications, hasNotifications } = useSession();
    const currentUser = session ? JSON.parse(session) : null;
    const [expenses, setExpenses] = useState<any[]>([]);
    const [settlements, setSettlements] = useState<any[]>([]);
    const [usersById, setUsersById] = useState<Record<string, string>>({});
    const [userAvatarsById, setUserAvatarsById] = useState<Record<string, string>>({});
    const [groupsById, setGroupsById] = useState<Record<string, string>>({});
    const [settlementDirectionFilter, setSettlementDirectionFilter] = useState<'ALL' | 'PAID' | 'RECEIVED'>('ALL');
    const [settlementScopeFilter, setSettlementScopeFilter] = useState<'ALL' | 'GROUP' | 'PERSONAL'>('ALL');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentToast, setCurrentToast] = useState<string | null>(null);

    const prevExpenseIds = useRef<Set<string>>(new Set());
    const isInitialLoad = useRef(true);

    const fetchExpenses = useCallback(async () => {
        try {
            const result = await api.getExpenses(currentUser?.id);
            if (result.success) {
                const sortedExpenses = result.data.sort((a: any, b: any) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                // Detect new expenses
                if (!isInitialLoad.current) {
                    result.data.forEach((expense: any) => {
                        if (!prevExpenseIds.current.has(expense.id)) {
                            if (expense.paidBy !== currentUser?.id) {
                                const message = `New expense: ${expense.title} (₹${expense.amount})`;
                                addNotification({ id: expense.id, message });
                                setCurrentToast(message);
                            }
                        }
                    });
                }

                prevExpenseIds.current = new Set(result.data.map((e: any) => e.id));
                isInitialLoad.current = false;

                setExpenses(sortedExpenses);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        }
    }, [currentUser?.id, addNotification]);

    const fetchGroups = useCallback(async () => {
        try {
            const result = await api.getGroups(currentUser?.id);
            if (result.success) {
                const map = (result.data || []).reduce((acc: Record<string, string>, group: any) => {
                    if (group?.id && group?.name) {
                        acc[group.id] = group.name;
                    }
                    return acc;
                }, {});
                setGroupsById(map);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    }, [currentUser?.id]);

    const fetchUsers = useCallback(async () => {
        try {
            const result = await api.getUsers();
            if (result.success) {
                const avatarMap = result.data.reduce((acc: Record<string, string>, user: any) => {
                    if (typeof user.avatar === 'string' && user.avatar.trim()) {
                        acc[user.id] = user.avatar.trim();
                    }
                    return acc;
                }, {});
                const userMap = result.data.reduce((acc: Record<string, string>, user: any) => {
                    if (user?.id) {
                        acc[user.id] = user.name || 'Unknown';
                    }
                    return acc;
                }, {});
                setUserAvatarsById(avatarMap);
                setUsersById(userMap);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }, []);

    const fetchSettlements = useCallback(async () => {
        try {
            const result = await api.getSettlements();
            if (result.success) {
                const sorted = result.data.sort((a: any, b: any) =>
                    new Date(b.settledAt || b.createdAt).getTime() - new Date(a.settledAt || a.createdAt).getTime()
                );
                setSettlements(sorted);
            }
        } catch (error) {
            console.error('Error fetching settlements:', error);
        }
    }, []);
    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        await Promise.all([fetchExpenses(), fetchGroups(), fetchUsers(), fetchSettlements()]);
        setLoading(false);
    }, [fetchExpenses, fetchGroups, fetchUsers, fetchSettlements]);

    useFocusEffect(
        useCallback(() => {
            fetchData(expenses.length === 0);

            const interval = setInterval(() => {
                fetchData(false);
            }, 10000);

            return () => clearInterval(interval);
        }, [fetchData, expenses.length])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData(false);
        setRefreshing(false);
    }, [fetchData]);

    const getCategoryTheme = (category: string) => {
        switch (category) {
            case 'Food': return { icon: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', color: '#FFF9C4' };
            case 'Travel': return { icon: 'https://cdn-icons-png.flaticon.com/512/201/201331.png', color: '#E8F5E9' };
            case 'Shopping': return { icon: 'https://cdn-icons-png.flaticon.com/512/2838/2838895.png', color: '#FFF3E0' };
            case 'Health': return { icon: 'https://cdn-icons-png.flaticon.com/512/2966/2966488.png', color: '#FCE4EC' };
            case 'Education': return { icon: 'https://cdn-icons-png.flaticon.com/512/2436/2436636.png', color: '#E3F2FD' };
            case 'Rent': return { icon: 'https://cdn-icons-png.flaticon.com/512/1946/1946488.png', color: '#F1F8E9' };
            case 'Utilities': return { icon: 'https://cdn-icons-png.flaticon.com/512/3079/3079167.png', color: '#FFFDE7' };
            case 'Transport': return { icon: 'https://cdn-icons-png.flaticon.com/512/744/744465.png', color: '#E8EAF6' };
            case 'Entertainment': return { icon: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png', color: '#F3E5F5' };
            case 'Bills': return { icon: 'https://cdn-icons-png.flaticon.com/512/1051/1051275.png', color: '#FFF3E0' };
            case 'Others': return { icon: 'https://cdn-icons-png.flaticon.com/512/570/570223.png', color: '#F5F5F5' };
            default: return { icon: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png', color: '#E1F5FE' };
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
            ' • ' +
            date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const getUserAvatar = (userId: string) => {
        return userAvatarsById[userId] || `https://i.pravatar.cc/150?u=${userId}`;
    };

    const filteredSettlements = useMemo(() => {
        return settlements.filter((settlement) => {
            const isYouPaid = settlement.fromUserId === currentUser?.id;
            const directionOk = settlementDirectionFilter === 'ALL'
                || (settlementDirectionFilter === 'PAID' && isYouPaid)
                || (settlementDirectionFilter === 'RECEIVED' && !isYouPaid);
            const scopeOk = settlementScopeFilter === 'ALL'
                || (settlementScopeFilter === 'GROUP' && Boolean(settlement.groupId))
                || (settlementScopeFilter === 'PERSONAL' && !settlement.groupId);
            return directionOk && scopeOk;
        });
    }, [currentUser?.id, settlementDirectionFilter, settlementScopeFilter, settlements]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Expense History</Text>
                    <Text style={styles.headerSubtitle}>View all your past transactions</Text>
                </View>

                <View style={styles.listContainer}>
                    <SectionHeader title="Settlement History" />
                    <View style={styles.filterRow}>
                        {(['ALL', 'PAID', 'RECEIVED'] as const).map((item) => (
                            <Text
                                key={`dir-${item}`}
                                style={[styles.filterChip, settlementDirectionFilter === item && styles.filterChipActive]}
                                onPress={() => setSettlementDirectionFilter(item)}
                            >
                                {item}
                            </Text>
                        ))}
                    </View>
                    <View style={styles.filterRow}>
                        {(['ALL', 'GROUP', 'PERSONAL'] as const).map((item) => (
                            <Text
                                key={`scope-${item}`}
                                style={[styles.filterChip, settlementScopeFilter === item && styles.filterChipActive]}
                                onPress={() => setSettlementScopeFilter(item)}
                            >
                                {item}
                            </Text>
                        ))}
                    </View>
                    {loading ? (
                        <ActivityIndicator size="small" color="#FF8C69" style={{ marginVertical: 20 }} />
                    ) : filteredSettlements.length > 0 ? (
                        <View style={styles.settlementList}>
                            {filteredSettlements.map((settlement) => {
                                const isYouPaid = settlement.fromUserId === currentUser?.id;
                                const counterpartyId = isYouPaid ? settlement.toUserId : settlement.fromUserId;
                                const counterpartyName = usersById[counterpartyId] || 'Unknown';
                                const groupName = settlement.groupId ? groupsById[settlement.groupId] : undefined;
                                const statusText = isYouPaid ? `You paid ${counterpartyName}` : `${counterpartyName} paid you`;
                                const amountColor = isYouPaid ? '#D9534F' : '#2E7D32';
                                return (
                                    <View key={settlement.id} style={styles.settlementCard}>
                                        <View style={styles.settlementTopRow}>
                                            <Text style={styles.settlementTitle}>{statusText}</Text>
                                            <Text style={[styles.settlementAmount, { color: amountColor }]}>
                                                {isYouPaid ? '-' : '+'}₹{(Number(settlement.amount) || 0).toFixed(2)}
                                            </Text>
                                        </View>
                                        <Text style={styles.settlementDate}>
                                            {formatDateTime(settlement.settledAt || settlement.createdAt)}
                                        </Text>
                                        {groupName ? (
                                            <Text style={styles.settlementMeta}>Group: {groupName}</Text>
                                        ) : (
                                            <Text style={styles.settlementMeta}>Personal settlement</Text>
                                        )}
                                        {settlement.note ? (
                                            <Text style={styles.settlementNote}>Note: {settlement.note}</Text>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={styles.emptySettlementState}>
                            <Text style={styles.emptySettlementTitle}>No settlements for this filter</Text>
                            <Text style={styles.emptySettlementSub}>Try a different settlement filter.</Text>
                        </View>
                    )}

                    <SectionHeader title="All Expenses" />
                    {loading ? (
                        <ActivityIndicator size="small" color="#FF8C69" style={{ marginVertical: 20 }} />
                    ) : expenses.length > 0 ? (
                        expenses.map((expense) => {
                            const theme = getCategoryTheme(expense.category);
                            const isOwed = expense.paidBy === currentUser?.id;
                            const splitBetween = expense.splitBetween || [];
                            const splitDetails = expense.splitDetails || [];
                            const isInSplit = splitBetween.includes(currentUser?.id);
                            let userAmount = 0;

                            if (isOwed) {
                                // How much others owe you for this bill
                                if (expense.splitType === 'EQUAL') {
                                    const count = splitBetween.length;
                                    if (count > 0) {
                                        const share = expense.amount / count;
                                        userAmount = isInSplit ? share * (count - 1) : expense.amount;
                                    }
                                } else {
                                    userAmount = splitDetails.reduce((acc: number, d: any) =>
                                        d.userId !== currentUser?.id ? acc + (d.amount || 0) : acc, 0);
                                }
                            } else if (isInSplit) {
                                // How much to pay for this bill (only if you're in the split)
                                if (expense.splitType === 'EQUAL') {
                                    const count = splitBetween.length;
                                    userAmount = count > 0 ? expense.amount / count : 0;
                                } else {
                                    userAmount = splitDetails.find((d: any) => d.userId === currentUser?.id)?.amount || 0;
                                }
                            }

                            return (
                                <BillItem
                                    key={expense.id}
                                    title={expense.title}
                                    date={formatDate(expense.date)}
                                    totalAmount={`₹${(expense.amount || 0).toFixed(2)}`}
                                    userAmount={`₹${userAmount.toFixed(2)}`}
                                    isOwed={isOwed}
                                    avatarGroup={(expense.splitBetween || []).map((id: string) => getUserAvatar(id))}
                                    icon={theme.icon}
                                    iconBackgroundColor={theme.color}
                                    groupName={expense.groupId ? groupsById[expense.groupId] : undefined}
                                    onPress={() => router.push({
                                        pathname: '/(tabs)/expense-detail',
                                        params: { expenseId: expense.id }
                                    })}
                                />
                            );
                        })
                    ) : (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ color: '#666' }}>No expenses found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {currentToast && (
                <NotificationToast
                    message={currentToast}
                    onHide={() => setCurrentToast(null)}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FF9F6A',
    },
    header: {
        padding: 24,
        paddingTop: 12,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: 'white',
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    listContainer: {
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 24,
        minHeight: '100%',
    },
    settlementList: {
        paddingHorizontal: 16,
        marginBottom: 18,
        gap: 10,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#EFEFEF',
        color: '#555',
        fontSize: 12,
        fontWeight: '700',
        overflow: 'hidden',
    },
    filterChipActive: {
        backgroundColor: '#FF8C69',
        color: '#fff',
    },
    settlementCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
    },
    settlementTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    settlementTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    settlementAmount: {
        fontSize: 14,
        fontWeight: '800',
    },
    settlementDate: {
        marginTop: 4,
        fontSize: 12,
        color: '#666',
    },
    settlementMeta: {
        marginTop: 4,
        fontSize: 12,
        color: '#666',
    },
    settlementNote: {
        marginTop: 6,
        fontSize: 12,
        color: '#555',
    },
    emptySettlementState: {
        paddingHorizontal: 20,
        paddingVertical: 18,
        alignItems: 'center',
    },
    emptySettlementTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    emptySettlementSub: {
        marginTop: 4,
        fontSize: 13,
        color: '#777',
    },
});

