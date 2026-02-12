import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BillItem } from '@/components/home/BillItem';
import { api } from '@/services/api';
import { useSession } from '@/ctx';
import { EditGroupForm } from '@/components/groups/EditGroupForm';

type ChartDatum = {
    key: string;
    label: string;
    value: number;
};

type EditableGroup = {
    id: string;
    name: string;
    members: string[];
};

type MemberBalance = {
    userId: string;
    name: string;
    balance: number;
};

const formatCurrency = (amount: number) => `Rs ${amount.toFixed(2)}`;

export default function GroupExpensesScreen() {
    const router = useRouter();
    const { groupId, groupName, groupMembers } = useLocalSearchParams<{
        groupId?: string | string[];
        groupName?: string | string[];
        groupMembers?: string | string[];
    }>();
    const { session } = useSession();
    const currentUser = session ? JSON.parse(session) : null;

    const parsedGroupId = Array.isArray(groupId) ? groupId[0] : groupId;
    const parsedGroupName = Array.isArray(groupName) ? groupName[0] : groupName;
    const parsedGroupMembers = Array.isArray(groupMembers) ? groupMembers[0] : groupMembers;
    const memberCount = useMemo(
        () => (parsedGroupMembers ? parsedGroupMembers.split(',').filter(Boolean).length : 0),
        [parsedGroupMembers]
    );

    const [expenses, setExpenses] = useState<any[]>([]);
    const [usersById, setUsersById] = useState<Record<string, string>>({});
    const [userAvatarsById, setUserAvatarsById] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'analytics'>('expenses');
    const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState<EditableGroup | null>(null);

    const groupMemberIds = useMemo(
        () => (parsedGroupMembers ? parsedGroupMembers.split(',').map((id) => id.trim()).filter(Boolean) : []),
        [parsedGroupMembers]
    );

    const groupMemberNames = useMemo(
        () => groupMemberIds.map((id) => usersById[id] || `User ${id.slice(0, 4)}`),
        [groupMemberIds, usersById]
    );

    const getCategoryTheme = (category: string) => {
        switch (category) {
            case 'Food': return { icon: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', color: '#FFF9C4' };
            case 'Travel': return { icon: 'https://cdn-icons-png.flaticon.com/512/201/201331.png', color: '#E8F5E9' };
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

    const getUserAvatar = useCallback((userId: string) => {
        return userAvatarsById[userId] || `https://i.pravatar.cc/150?u=${userId}`;
    }, [userAvatarsById]);

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

    const groupSummary = useMemo(() => {
        return expenses.reduce(
            (acc, expense) => {
                const impact = calculateExpenseImpact(expense);
                acc.pay += impact.pay;
                acc.get += impact.get;
                return acc;
            },
            { pay: 0, get: 0 }
        );
    }, [calculateExpenseImpact, expenses]);

    const filteredExpenses = useMemo(() => {
        const query = expenseSearchQuery.trim().toLowerCase();
        if (!query) {
            return expenses;
        }

        return expenses.filter((expense: any) => {
            const title = String(expense.title || '').toLowerCase();
            const category = String(expense.category || '').toLowerCase();
            const payer = String(usersById[expense.paidBy] || '').toLowerCase();
            return title.includes(query) || category.includes(query) || payer.includes(query);
        });
    }, [expenseSearchQuery, expenses, usersById]);

    const memberBalances = useMemo<MemberBalance[]>(() => {
        if (!currentUser?.id) return [];

        return groupMemberIds
            .filter((memberId) => memberId !== currentUser.id)
            .map((memberId) => {
                let balance = 0;

                expenses.forEach((expense: any) => {
                    const splitBetween: string[] = expense.splitBetween || [];
                    const splitDetails: Array<{ userId: string; amount?: number }> = expense.splitDetails || [];
                    const isPaidByMe = expense.paidBy === currentUser.id;
                    const isPaidByMember = expense.paidBy === memberId;
                    const isMeInSplit = splitBetween.includes(currentUser.id);
                    const isMemberInSplit = splitBetween.includes(memberId);

                    const equalShare = splitBetween.length > 0 ? (Number(expense.amount) || 0) / splitBetween.length : 0;
                    const getSplitAmount = (userId: string) => {
                        if (expense.splitType === 'EQUAL') {
                            return splitBetween.includes(userId) ? equalShare : 0;
                        }
                        return splitDetails.find((detail) => detail.userId === userId)?.amount || 0;
                    };

                    if (isPaidByMe && isMemberInSplit) {
                        balance += getSplitAmount(memberId);
                    } else if (isPaidByMember && isMeInSplit) {
                        balance -= getSplitAmount(currentUser.id);
                    }
                });

                return {
                    userId: memberId,
                    name: usersById[memberId] || `User ${memberId.slice(0, 4)}`,
                    balance,
                };
            })
            .filter((member) => Math.abs(member.balance) > 0.001)
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    }, [currentUser?.id, expenses, groupMemberIds, usersById]);

    const analytics = useMemo(() => {
        const spendByDate: Record<string, number> = {};
        const spendByCategory: Record<string, number> = {};
        const spendByPayer: Record<string, number> = {};
        let participationCount = 0;
        let highestExpense = 0;

        expenses.forEach((expense: any) => {
            const amount = Number(expense.amount) || 0;
            highestExpense = Math.max(highestExpense, amount);

            const dateObj = new Date(expense.date);
            const dateKey = Number.isNaN(dateObj.getTime())
                ? 'Unknown'
                : dateObj.toISOString().slice(0, 10);
            spendByDate[dateKey] = (spendByDate[dateKey] || 0) + amount;

            const category = (expense.category || 'Others').trim() || 'Others';
            spendByCategory[category] = (spendByCategory[category] || 0) + amount;

            const payerId = expense.paidBy || 'Unknown';
            spendByPayer[payerId] = (spendByPayer[payerId] || 0) + amount;

            const splitBetween: string[] = expense.splitBetween || [];
            const splitDetails: Array<{ userId: string; amount?: number }> = expense.splitDetails || [];

            if (expense.splitType === 'EQUAL') {
                const count = splitBetween.length;
                if (count > 0) {
                    participationCount += count;
                }
            } else {
                const validDetailsCount = splitDetails.filter((detail) =>
                    groupMemberIds.includes(detail.userId),
                ).length;
                participationCount += validDetailsCount;
            }
        });

        const dateChart: ChartDatum[] = Object.entries(spendByDate)
            .map(([key, value]) => {
                const dateObj = new Date(key);
                const label = Number.isNaN(dateObj.getTime())
                    ? 'Unknown date'
                    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return { key, label, value };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const categoryChart: ChartDatum[] = Object.entries(spendByCategory)
            .map(([key, value]) => ({ key, label: key, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const payerChart: ChartDatum[] = Object.entries(spendByPayer)
            .map(([key, value]) => ({
                key,
                label: usersById[key] || (key === 'Unknown' ? 'Unknown user' : `User ${key.slice(0, 4)}`),
                value,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const topDate = dateChart[0];
        const topCategory = categoryChart[0];
        const topPayer = payerChart[0];
        const totalGroupSpend = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const memberCountForAverage = groupMemberIds.length || 1;
        const averageSharePerParticipation = participationCount
            ? totalGroupSpend / participationCount
            : 0;
        return {
            totalGroupSpend,
            averagePerMemberGroupSize: totalGroupSpend / memberCountForAverage,
            averageSharePerParticipation,
            highestExpense,
            topDate,
            topCategory,
            topPayer,
            dateChart,
            categoryChart,
            payerChart,
        };
    }, [expenses, groupMemberIds, usersById]);

    const fetchData = useCallback(async (showLoading = true) => {
        if (!parsedGroupId) {
            if (showLoading) setLoading(false);
            return;
        }

        if (showLoading) setLoading(true);

        const [expensesResult, usersResult] = await Promise.all([
            api.getExpenses(undefined, parsedGroupId),
            api.getUsers(),
        ]);

        if (expensesResult.success) {
            const sorted = expensesResult.data.sort(
                (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setExpenses(sorted);
        }

        if (usersResult.success) {
            const mappedUsers = usersResult.data.reduce((acc: Record<string, string>, user: any) => {
                acc[user.id] = user.name;
                return acc;
            }, {});
            const mappedAvatars = usersResult.data.reduce((acc: Record<string, string>, user: any) => {
                if (typeof user.avatar === 'string' && user.avatar.trim()) {
                    acc[user.id] = user.avatar.trim();
                }
                return acc;
            }, {});
            setUsersById(mappedUsers);
            setUserAvatarsById(mappedAvatars);
        }

        if (showLoading) setLoading(false);
    }, [parsedGroupId]);

    useFocusEffect(
        useCallback(() => {
            fetchData(expenses.length === 0);
        }, [expenses.length, fetchData])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData(false);
        setRefreshing(false);
    }, [fetchData]);

    const handleOpenEditGroup = useCallback(() => {
        if (!parsedGroupId) return;
        setEditingGroup({
            id: parsedGroupId,
            name: parsedGroupName || 'Group',
            members: groupMemberIds,
        });
        setIsEditModalVisible(true);
    }, [groupMemberIds, parsedGroupId, parsedGroupName]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/groups')} style={styles.backButton}>
                    <IconSymbol size={20} name="chevron.left" color="white" />
                </TouchableOpacity>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>{parsedGroupName || 'Group'}</Text>
                    <Text style={styles.headerSub}>{memberCount} members</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.editHeaderButton} onPress={handleOpenEditGroup}>
                        <IconSymbol size={18} name="pencil" color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addExpenseHeaderButton}
                        onPress={() =>
                            router.push({
                                pathname: '/(tabs)/add',
                                params: {
                                    source: 'group',
                                    groupId: parsedGroupId,
                                    groupName: parsedGroupName,
                                    groupMembers: parsedGroupMembers,
                                },
                            })
                        }
                    >
                        <IconSymbol size={20} name="plus" color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />}
            >
                <View style={styles.membersCard}>
                    <Text style={styles.membersTitle}>Group members</Text>
                    <View style={styles.membersWrap}>
                        {groupMemberNames.map((name, index) => (
                            <View key={`${name}-${index}`} style={styles.memberPill}>
                                <Text style={styles.memberPillText}>{name}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.tabsCard}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('expenses')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'expenses' && styles.tabButtonTextActive]}>
                            Expenses
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('analytics')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'analytics' && styles.tabButtonTextActive]}>
                            Analytics
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'balances' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('balances')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'balances' && styles.tabButtonTextActive]}>
                            Balances
                        </Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="small" color="#FF8C69" style={{ marginTop: 24 }} />
                ) : activeTab === 'expenses' ? (
                    <>
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search group expenses..."
                                placeholderTextColor="#999"
                                value={expenseSearchQuery}
                                onChangeText={setExpenseSearchQuery}
                            />
                            {expenseSearchQuery.length > 0 ? (
                                <TouchableOpacity onPress={() => setExpenseSearchQuery('')}>
                                    <Text style={styles.clearSearchText}>Clear</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <View style={styles.summaryCard}>
                            <View style={styles.summaryItemPay}>
                                <Text style={styles.summaryLabelPay}>You Pay</Text>
                                <Text style={styles.summaryValuePay}>{formatCurrency(groupSummary.pay)}</Text>
                            </View>
                            <View style={styles.summaryItemGet}>
                                <Text style={styles.summaryLabelGet}>You Get</Text>
                                <Text style={styles.summaryValueGet}>{formatCurrency(groupSummary.get)}</Text>
                            </View>
                        </View>

                        {filteredExpenses.length > 0 ? (
                            filteredExpenses.map((expense) => {
                                const theme = getCategoryTheme(expense.category);
                                const impact = calculateExpenseImpact(expense);
                                const isOwed = impact.get >= impact.pay;
                                const userAmount = isOwed ? impact.get : impact.pay;

                                return (
                                    <BillItem
                                        key={expense.id}
                                        title={expense.title}
                                        date={formatDate(expense.date)}
                                        totalAmount={formatCurrency(expense.amount || 0)}
                                        userAmount={formatCurrency(userAmount)}
                                        isOwed={isOwed}
                                        avatarGroup={(expense.splitBetween || []).map((id: string) => getUserAvatar(id))}
                                        icon={theme.icon}
                                        iconBackgroundColor={theme.color}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/(tabs)/expense-detail',
                                                params: {
                                                    expenseId: expense.id,
                                                    returnToGroupId: parsedGroupId,
                                                    returnToGroupName: parsedGroupName,
                                                    returnToGroupMembers: parsedGroupMembers,
                                                },
                                            })
                                        }
                                    />
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>
                                    {expenseSearchQuery.trim() ? 'No matching expenses' : 'No expenses in this group'}
                                </Text>
                                <Text style={styles.emptySub}>
                                    {expenseSearchQuery.trim()
                                        ? 'Try a different keyword.'
                                        : 'Add an expense to start tracking this group.'}
                                </Text>
                            </View>
                        )}
                    </>
                ) : activeTab === 'balances' ? (
                    memberBalances.length > 0 ? (
                        <View style={styles.memberBalanceCard}>
                            <Text style={styles.memberBalanceTitle}>Group balances with you</Text>
                            {memberBalances.map((member) => {
                                const status = member.balance > 0 ? 'You get' : 'You pay';
                                const amountColor = member.balance > 0 ? '#2E7D32' : '#D9534F';

                                return (
                                    <TouchableOpacity
                                        key={member.userId}
                                        style={styles.memberBalanceRow}
                                        activeOpacity={0.8}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/(tabs)/user-detail',
                                                params: { userId: member.userId },
                                            })
                                        }
                                    >
                                        <View style={styles.memberAvatar}>
                                            <Text style={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
                                        </View>
                                        <View style={styles.memberInfo}>
                                            <Text style={styles.memberName}>{member.name}</Text>
                                            <Text style={styles.memberStatus}>{status}</Text>
                                        </View>
                                        <Text style={[styles.memberAmount, { color: amountColor }]}>
                                            {formatCurrency(Math.abs(member.balance))}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>No pending balances</Text>
                            <Text style={styles.emptySub}>All balances in this group are settled for now.</Text>
                        </View>
                    )
                ) : (
                    <>
                        {expenses.length > 0 ? (
                            <>
                                <View style={styles.avgMetricsCard}>
                                    <Text style={styles.avgMetricsTitle}>Average metrics</Text>
                                    <View style={styles.avgMetricsRow}>
                                        <View style={styles.avgMetricPill}>
                                            <Text style={styles.avgMetricLabel}>Avg/member (group size)</Text>
                                            <Text style={styles.avgMetricValue}>
                                                {formatCurrency(analytics.averagePerMemberGroupSize)}
                                            </Text>
                                        </View>
                                        <View style={styles.avgMetricPill}>
                                            <Text style={styles.avgMetricLabel}>Avg/share (per participation)</Text>
                                            <Text style={styles.avgMetricValue}>
                                                {formatCurrency(analytics.averageSharePerParticipation)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.analyticsCard}>
                                    <Text style={styles.analyticsTitle}>Group insights</Text>
                                    <View style={styles.analyticsGrid}>
                                        <View style={styles.analyticsPill}>
                                            <Text style={styles.analyticsPillLabel}>Total spend</Text>
                                            <Text style={styles.analyticsPillValue}>{formatCurrency(analytics.totalGroupSpend)}</Text>
                                        </View>
                                        <View style={styles.analyticsPill}>
                                            <Text style={styles.analyticsPillLabel}>Top date</Text>
                                            <Text style={styles.analyticsPillValue}>{analytics.topDate?.label || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.analyticsPill}>
                                            <Text style={styles.analyticsPillLabel}>Top category</Text>
                                            <Text style={styles.analyticsPillValue}>{analytics.topCategory?.label || 'N/A'}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.analyticsSub}>
                                        Highest single expense: {formatCurrency(analytics.highestExpense)}.
                                        Biggest spender: {analytics.topPayer?.label || 'N/A'} ({formatCurrency(analytics.topPayer?.value || 0)}).
                                    </Text>
                                </View>

                                <View style={styles.chartCard}>
                                    <Text style={styles.chartTitle}>Most spending by date</Text>
                                    {analytics.dateChart.map((item) => {
                                        const max = analytics.dateChart[0]?.value || 1;
                                        return (
                                            <View key={item.key} style={styles.chartRow}>
                                                <View style={styles.chartRowTop}>
                                                    <Text style={styles.chartLabel}>{item.label}</Text>
                                                    <Text style={styles.chartValue}>{formatCurrency(item.value)}</Text>
                                                </View>
                                                <View style={styles.chartBarBg}>
                                                    <View style={[styles.chartBarFillDate, { width: `${(item.value / max) * 100}%` }]} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>

                                <View style={styles.chartCard}>
                                    <Text style={styles.chartTitle}>Most spending by category</Text>
                                    {analytics.categoryChart.map((item) => {
                                        const max = analytics.categoryChart[0]?.value || 1;
                                        return (
                                            <View key={item.key} style={styles.chartRow}>
                                                <View style={styles.chartRowTop}>
                                                    <Text style={styles.chartLabel}>{item.label}</Text>
                                                    <Text style={styles.chartValue}>{formatCurrency(item.value)}</Text>
                                                </View>
                                                <View style={styles.chartBarBg}>
                                                    <View style={[styles.chartBarFillCategory, { width: `${(item.value / max) * 100}%` }]} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>

                                <View style={styles.chartCard}>
                                    <Text style={styles.chartTitle}>Who spent the most</Text>
                                    {analytics.payerChart.map((item) => {
                                        const max = analytics.payerChart[0]?.value || 1;
                                        return (
                                            <View key={item.key} style={styles.chartRow}>
                                                <View style={styles.chartRowTop}>
                                                    <Text style={styles.chartLabel}>{item.label}</Text>
                                                    <Text style={styles.chartValue}>{formatCurrency(item.value)}</Text>
                                                </View>
                                                <View style={styles.chartBarBg}>
                                                    <View style={[styles.chartBarFillPayer, { width: `${(item.value / max) * 100}%` }]} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>

                            </>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>No analytics yet</Text>
                                <Text style={styles.emptySub}>Add some expenses to see charts and insights.</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

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
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addExpenseHeaderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editHeaderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTextWrap: {
        flex: 1,
        marginHorizontal: 12,
    },
    headerTitle: {
        fontSize: 22,
        color: 'white',
        fontWeight: '800',
    },
    headerSub: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
    },
    content: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 20,
    },
    membersCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 14,
    },
    membersTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    membersWrap: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    memberPill: {
        backgroundColor: '#FFF0ED',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    memberPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#C85F3D',
    },
    tabsCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: '#ECECEC',
        borderRadius: 12,
        padding: 4,
        flexDirection: 'row',
    },
    tabButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonActive: {
        backgroundColor: 'white',
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#666',
    },
    tabButtonTextActive: {
        color: '#FF8C69',
    },
    summaryCard: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 20,
        marginBottom: 14,
    },
    searchContainer: {
        marginHorizontal: 20,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        minHeight: 44,
    },
    searchInput: {
        flex: 1,
        color: '#1E1E1E',
        fontSize: 14,
        paddingVertical: 10,
    },
    clearSearchText: {
        color: '#FF8C69',
        fontSize: 13,
        fontWeight: '700',
    },
    summaryItemPay: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#FFF3F3',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    summaryItemGet: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#EEF9EE',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    summaryLabelPay: {
        fontSize: 12,
        fontWeight: '600',
        color: '#D9534F',
    },
    summaryLabelGet: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2E7D32',
    },
    summaryValuePay: {
        marginTop: 2,
        fontSize: 16,
        fontWeight: '700',
        color: '#D9534F',
    },
    summaryValueGet: {
        marginTop: 2,
        fontSize: 16,
        fontWeight: '700',
        color: '#2E7D32',
    },
    avgMetricsCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 14,
    },
    avgMetricsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E1E1E',
        marginBottom: 10,
    },
    avgMetricsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    avgMetricPill: {
        flex: 1,
        backgroundColor: '#F7F7F7',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    avgMetricLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '600',
    },
    avgMetricValue: {
        marginTop: 4,
        fontSize: 14,
        color: '#111',
        fontWeight: '700',
    },
    memberBalanceCard: {
        marginHorizontal: 20,
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 14,
    },
    memberBalanceTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E1E1E',
        marginBottom: 8,
    },
    memberBalanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#F2F2F2',
    },
    memberAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFF0ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    memberAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#C85F3D',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    memberStatus: {
        marginTop: 2,
        fontSize: 12,
        color: '#777',
    },
    memberAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    analyticsCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 14,
    },
    analyticsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    analyticsGrid: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    analyticsPill: {
        width: '48%',
        backgroundColor: '#F7F7F7',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    analyticsPillLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '600',
    },
    analyticsPillValue: {
        marginTop: 4,
        fontSize: 14,
        color: '#111',
        fontWeight: '700',
    },
    analyticsSub: {
        marginTop: 10,
        color: '#555',
        fontSize: 12,
        lineHeight: 18,
    },
    chartCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 14,
    },
    chartTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E1E1E',
        marginBottom: 8,
    },
    chartRow: {
        marginTop: 8,
    },
    chartRowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    chartLabel: {
        color: '#444',
        fontSize: 12,
        fontWeight: '600',
    },
    chartValue: {
        color: '#222',
        fontSize: 12,
        fontWeight: '700',
    },
    chartBarBg: {
        height: 8,
        borderRadius: 999,
        backgroundColor: '#EFEFEF',
        overflow: 'hidden',
    },
    chartBarFillDate: {
        height: '100%',
        backgroundColor: '#FF8C69',
        borderRadius: 999,
    },
    chartBarFillCategory: {
        height: '100%',
        backgroundColor: '#64B5F6',
        borderRadius: 999,
    },
    chartBarFillPayer: {
        height: '100%',
        backgroundColor: '#66BB6A',
        borderRadius: 999,
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
