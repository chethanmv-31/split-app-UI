import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, Platform, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/home/Header';
import { SummaryCard } from '@/components/home/SummaryCard';
import { SectionHeader } from '@/components/home/SectionHeader';
import { BillItem } from '@/components/home/BillItem';
import { FriendItem } from '@/components/home/FriendItem';
import { NotificationsModal } from '@/components/home/NotificationsModal';
import { api } from '../../services/api';
import { useSession } from '../../ctx';
import { useFocusEffect, useRouter } from 'expo-router';
import { useNotifications } from '@/hooks/useNotifications';

export default function HomeScreen() {
  const router = useRouter();
  const { session, addNotification, notifications, hasNotifications } = useSession();
  const currentUser = session ? JSON.parse(session) : null;
  const [users, setUsers] = useState<any[]>([]);
  const [userAvatarsById, setUserAvatarsById] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<any[]>([]);
  const [groupsById, setGroupsById] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState({ youOwe: 0, owesYou: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const prevExpenseIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

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
        const otherUsers = result.data.filter((u: any) => u.id !== currentUser?.id);
        setUserAvatarsById(avatarMap);
        setUsers(otherUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [currentUser?.id]);

  const getUserAvatar = useCallback((userId: string) => {
    return userAvatarsById[userId] || `https://i.pravatar.cc/150?u=${userId}`;
  }, [userAvatarsById]);

  const fetchExpenses = useCallback(async () => {
    try {
      const result = await api.getExpenses();
      if (result.success) {
        const sortedExpenses = result.data.sort((a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Detect new expenses for notifications
        if (!isInitialLoad.current) {
          result.data.forEach((expense: any) => {
            if (!prevExpenseIds.current.has(expense.id)) {
              if (expense.paidBy !== currentUser?.id) {
                const message = `New expense: ${expense.title} (₹${expense.amount})`;
                addNotification({ id: expense.id, message });
              }
            }
          });
        }

        // Update tracking ref
        prevExpenseIds.current = new Set(result.data.map((e: any) => e.id));
        isInitialLoad.current = false;

        setExpenses(sortedExpenses);
        calculateSummary(result.data);
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
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    await Promise.all([fetchUsers(), fetchExpenses(), fetchGroups()]);
    setLoading(false);
  }, [fetchUsers, fetchExpenses, fetchGroups]);

  useFocusEffect(
    useCallback(() => {
      fetchData(expenses.length === 0);

      // Set up polling interval (every 10 seconds)
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

  const calculateSummary = (expenseList: any[]) => {
    let youOwe = 0;
    let owesYou = 0;

    expenseList.forEach(expense => {
      const isPaidByMe = expense.paidBy === currentUser?.id;
      const splitBetween = expense.splitBetween || [];
      const isInSplit = splitBetween.includes(currentUser?.id);

      if (isPaidByMe) {
        // Others owe me
        if (expense.splitType === 'EQUAL') {
          const count = splitBetween.length;
          if (count > 0) {
            const share = expense.amount / count;
            // If I'm in the split, they owe me (Total - my share)
            // If I'm NOT in the split, they owe me the full amount
            owesYou += isInSplit ? share * (count - 1) : expense.amount;
          }
        } else {
          (expense.splitDetails || []).forEach((detail: any) => {
            if (detail.userId !== currentUser?.id) {
              owesYou += detail.amount || 0;
            }
          });
        }
      } else if (isInSplit) {
        // I owe others (only if I'm in the split)
        if (expense.splitType === 'EQUAL') {
          const count = splitBetween.length;
          if (count > 0) {
            youOwe += expense.amount / count;
          }
        } else {
          const myDetail = (expense.splitDetails || []).find((d: any) => d.userId === currentUser?.id);
          if (myDetail) {
            youOwe += myDetail.amount || 0;
          }
        }
      }
    });

    setSummary({ youOwe, owesYou });
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />
        }
      >
        <Header />

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <SummaryCard title="Pay" amount={`₹${summary.youOwe.toFixed(2)}`} type="owe" />
          <SummaryCard title="Get" amount={`₹${summary.owesYou.toFixed(2)}`} type="owed" />
        </View>

        {/* Pending Bills Section */}
        <View>
          <SectionHeader
            title="Recent Expenses"
            actionText="View All"
            onAction={() => router.push('/history')}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#FF8C69" style={{ marginVertical: 20 }} />
          ) : expenses.length > 0 ? (
            expenses.slice(0, 3).map((expense) => {
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

              const icon = theme.icon;
              const isNew = notifications.some(n => n.id === expense.id);

              return (
                <BillItem
                  key={expense.id}
                  title={expense.title}
                  date={formatDate(expense.date)}
                  totalAmount={`₹${(expense.amount || 0).toFixed(2)}`}
                  userAmount={`₹${userAmount.toFixed(2)}`}
                  isOwed={isOwed}
                  avatarGroup={(expense.splitBetween || []).map((id: string) => getUserAvatar(id))}
                  icon={icon}
                  groupName={expense.groupId ? groupsById[expense.groupId] : undefined}
                  isHighlight={isNew && hasNotifications}
                  onPress={() => router.push({
                    pathname: '/(tabs)/expense-detail',
                    params: { expenseId: expense.id }
                  })}
                />
              );
            })
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>No expenses yet</Text>
            </View>
          )}
        </View>

        {/* Friends Section */}
        <View style={styles.friendsContainer}>
          <SectionHeader title="Friends" textColor="#1E1E1E" />
          {loading ? (
            <ActivityIndicator size="large" color="#FF8C69" style={{ marginTop: 20 }} />
          ) : (() => {
            // Filter users to only those who share an expense
            const friendsWithBalance = users.map(user => {
              let balance = 0;
              let hasSharedExpense = false;

              expenses.forEach(expense => {
                const isPaidByMe = expense.paidBy === currentUser?.id;
                const isPaidByUser = expense.paidBy === user.id;
                const splitBetween = expense.splitBetween || [];
                const isInSplit = splitBetween.includes(currentUser?.id);
                const isUserInSplit = splitBetween.includes(user.id);

                if (isPaidByMe && isUserInSplit) {
                  hasSharedExpense = true;
                  if (expense.splitType === 'EQUAL') {
                    balance += expense.amount / splitBetween.length;
                  } else {
                    const userDetail = (expense.splitDetails || []).find((d: any) => d.userId === user.id);
                    if (userDetail) balance += userDetail.amount || 0;
                  }
                } else if (isPaidByUser && isInSplit) {
                  hasSharedExpense = true;
                  if (expense.splitType === 'EQUAL') {
                    balance -= expense.amount / splitBetween.length;
                  } else {
                    const myDetail = (expense.splitDetails || []).find((d: any) => d.userId === currentUser?.id);
                    if (myDetail) balance -= myDetail.amount || 0;
                  }
                }
              });

              return { ...user, balance, hasSharedExpense };
            }).filter(f => f.hasSharedExpense);

            return friendsWithBalance.length > 0 ? (
              friendsWithBalance.map((friend) => (
                <FriendItem
                  key={friend.id}
                  name={friend.name}
                  status={friend.balance === 0 ? "Settled up" : (friend.balance > 0 ? "Get" : "Pay")}
                  amount={friend.balance === 0 ? "" : `₹${Math.abs(friend.balance).toFixed(2)}`}
                  isOwed={friend.balance >= 0}
                  avatar={getUserAvatar(friend.id)}
                  onPress={() => router.push({ pathname: '/(tabs)/user-detail', params: { userId: friend.id } })}
                />
              ))
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#666', fontSize: 16 }}>No connections found yet.</Text>
                <Text style={{ color: '#999', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  Add an expense and split it with friends to see them here!
                </Text>
              </View>
            );
          })()}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF9F6A',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  friendsContainer: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 100, // Space for tab bar
    marginTop: 24,
    minHeight: 400,
  },
});





