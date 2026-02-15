import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '../../services/api';
import { useSession } from '../../ctx';

type LedgerEvent = {
  id: string;
  kind: 'expense' | 'settlement';
  title: string;
  date: string;
  amountImpact: number;
  runningBalance: number;
  expenseId?: string;
  note?: string;
};

export default function UserDetailScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { session } = useSession();
  const currentUser = session ? JSON.parse(session) : null;
  const parsedUserId = Array.isArray(userId) ? userId[0] : userId;

  const [user, setUser] = useState<any>(null);
  const [sharedExpenses, setSharedExpenses] = useState<any[]>([]);
  const [sharedSettlements, setSharedSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [parsedUserId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, expensesRes, settlementsRes] = await Promise.all([
        api.getUsers(),
        api.getExpenses(currentUser?.id),
        api.getSettlements(),
      ]);

      if (usersRes.success && expensesRes.success) {
        const foundUser = usersRes.data.find((u: any) => u.id === parsedUserId);
        setUser(foundUser);

        const shared = expensesRes.data
          .filter((e: any) => {
            const split = e.splitBetween || [];
            return split.includes(parsedUserId) && split.includes(currentUser?.id);
          })
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSharedExpenses(shared);
      }

      if (settlementsRes.success) {
        const related = settlementsRes.data
          .filter((s: any) => (
            (s.fromUserId === currentUser?.id && s.toUserId === parsedUserId)
            || (s.fromUserId === parsedUserId && s.toUserId === currentUser?.id)
          ))
          .sort((a: any, b: any) => new Date(b.settledAt || b.createdAt).getTime() - new Date(a.settledAt || a.createdAt).getTime());
        setSharedSettlements(related);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getShareForUser = (expense: any, targetUserId: string) => {
    const splitBetween = expense.splitBetween || [];
    const splitDetails = expense.splitDetails || [];

    if (expense.splitType === 'EQUAL') {
      const count = splitBetween.length;
      if (count <= 0) return 0;
      return splitBetween.includes(targetUserId) ? (Number(expense.amount) || 0) / count : 0;
    }

    return splitDetails.find((d: any) => d.userId === targetUserId)?.amount || 0;
  };

  const getMyNetForExpense = (expense: any) => {
    const payerId = expense.paidBy;
    if (payerId === currentUser?.id) {
      return getShareForUser(expense, parsedUserId || '');
    }
    if (payerId === parsedUserId) {
      return -getShareForUser(expense, currentUser?.id || '');
    }
    return 0;
  };

  const ledgerEvents = useMemo<LedgerEvent[]>(() => {
    const expenseEvents = sharedExpenses.map((exp: any) => ({
      id: `expense-${exp.id}`,
      kind: 'expense' as const,
      title: exp.title,
      date: exp.date,
      amountImpact: getMyNetForExpense(exp),
      expenseId: exp.id,
      note: exp.category,
    }));

    const settlementEvents = sharedSettlements.map((item: any) => {
      const fromMe = item.fromUserId === currentUser?.id;
      return {
        id: `settlement-${item.id}`,
        kind: 'settlement' as const,
        title: fromMe ? `You paid ${user?.name || 'user'}` : `${user?.name || 'User'} paid you`,
        date: item.settledAt || item.createdAt,
        amountImpact: fromMe ? -(Number(item.amount) || 0) : (Number(item.amount) || 0),
        note: item.note,
      };
    });

    const chronological = [...expenseEvents, ...settlementEvents].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let running = 0;
    return chronological.map((event) => {
      running += event.amountImpact;
      return { ...event, runningBalance: running };
    }).reverse();
  }, [currentUser?.id, parsedUserId, sharedExpenses, sharedSettlements, user?.name]);

  const net = useMemo(() => (ledgerEvents.length > 0 ? ledgerEvents[0].runningBalance : 0), [ledgerEvents]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C69" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#999' }}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
          <IconSymbol size={24} name="chevron.left" color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mainCard}>
          <Image source={{ uri: user.avatar || `https://i.pravatar.cc/150?u=${user.id}` }} style={styles.avatarLarge} />
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userPhone}>{user.mobile || ''}</Text>
          <Text style={styles.netLabel}>Net balance</Text>
          <Text style={[styles.netAmount, { color: net >= 0 ? '#2E7D32' : '#D32F2F' }]}>
            {net >= 0 ? `₹${Math.abs(net).toFixed(2)} (Get)` : `₹${Math.abs(net).toFixed(2)} (Pay)`}
          </Text>
        </View>

        <View style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Ledger (Expenses + Settlements)</Text>
          {ledgerEvents.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>No transactions yet</Text>
            </View>
          ) : (
            ledgerEvents.map((event) => {
              const impact = event.amountImpact;
              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.expRow}
                  onPress={() => {
                    if (event.kind === 'expense' && event.expenseId) {
                      router.push({ pathname: '/(tabs)/expense-detail', params: { expenseId: event.expenseId } });
                    }
                  }}
                >
                  <View>
                    <Text style={styles.expTitle}>{event.title}</Text>
                    <Text style={styles.expDate}>{formatDate(event.date)}</Text>
                    {event.note ? <Text style={styles.expDate}>{event.note}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.expAmount, { color: impact >= 0 ? '#2E7D32' : '#D32F2F' }]}>
                      {impact >= 0 ? `+₹${Math.abs(impact).toFixed(2)}` : `-₹${Math.abs(impact).toFixed(2)}`}
                    </Text>
                    <Text style={styles.expDate}>
                      {event.runningBalance >= 0
                        ? `Balance: Get ₹${Math.abs(event.runningBalance).toFixed(2)}`
                        : `Balance: Pay ₹${Math.abs(event.runningBalance).toFixed(2)}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FF9F6A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
  content: { flex: 1, backgroundColor: '#F5F5F5', borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingHorizontal: 20, paddingTop: 30 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  mainCard: { backgroundColor: 'white', borderRadius: 25, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  avatarLarge: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: '700', color: '#1E1E1E' },
  userPhone: { fontSize: 14, color: '#999', marginTop: 4 },
  netLabel: { fontSize: 13, color: '#666', marginTop: 12 },
  netAmount: { fontSize: 20, fontWeight: '700', marginTop: 6 },
  splitCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E1E1E', marginBottom: 12 },
  expRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  expTitle: { fontSize: 15, fontWeight: '600', color: '#1E1E1E' },
  expDate: { fontSize: 12, color: '#999', marginTop: 4 },
  expAmount: { fontSize: 14, fontWeight: '700' },
});
