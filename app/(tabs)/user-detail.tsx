import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '../../services/api';
import { useSession } from '../../ctx';

export default function UserDetailScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { session } = useSession();
  const currentUser = session ? JSON.parse(session) : null;
  const [user, setUser] = useState<any>(null);
  const [sharedExpenses, setSharedExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, expensesRes] = await Promise.all([api.getUsers(), api.getExpenses()]);
      if (usersRes.success && expensesRes.success) {
        const foundUser = usersRes.data.find((u: any) => u.id === userId);
        setUser(foundUser);

        const shared = expensesRes.data.filter((e: any) => {
          const split = e.splitBetween || [];
          return split.includes(userId) && split.includes(currentUser?.id);
        }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSharedExpenses(shared);
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

  const getMyNetForExpense = (expense: any) => {
    if (expense.splitType === 'EQUAL') {
      const count = (expense.splitBetween || []).length;
      const share = count > 0 ? expense.amount / count : 0;
      if (expense.paidBy === currentUser?.id) {
        // others owe me (excluding me)
        return (expense.splitBetween.includes(currentUser?.id) ? share * (count - 1) : expense.amount) - (expense.splitBetween.includes(userId) ? share : 0);
      } else if (expense.paidBy === userId) {
        // I owe user (my share)
        return -share;
      } else {
        // neither paid by us; compute my share vs their share
        const myShare = share;
        const theirShare = share;
        return myShare - theirShare;
      }
    } else {
      const myDetail = (expense.splitDetails || []).find((d: any) => d.userId === currentUser?.id);
      const theirDetail = (expense.splitDetails || []).find((d: any) => d.userId === userId);
      const myAmt = myDetail ? myDetail.amount : 0;
      const theirAmt = theirDetail ? theirDetail.amount : 0;

      if (expense.paidBy === currentUser?.id) {
        // others owe me
        return (expense.splitBetween.includes(currentUser?.id) ? 0 : 0) + (theirAmt ? theirAmt : 0) * -0 + (theirAmt || 0);
      }

      if (expense.paidBy === userId) {
        return -myAmt;
      }

      return myAmt - theirAmt;
    }
  };

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

  // calculate overall balance between currentUser and this user
  let net = 0;
  sharedExpenses.forEach(exp => {
    const val = getMyNetForExpense(exp);
    net += val;
  });

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
          <Text style={[styles.netAmount, { color: net >= 0 ? '#2E7D32' : '#D32F2F' }]}>{net >= 0 ? `₹${Math.abs(net).toFixed(2)} (Get)` : `₹${Math.abs(net).toFixed(2)} (Pay)`}</Text>
        </View>

        <View style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Shared Expenses</Text>
          {sharedExpenses.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>No shared expenses yet</Text>
            </View>
          ) : (
            sharedExpenses.map((exp: any) => {
              const myNet = getMyNetForExpense(exp);
              return (
                <TouchableOpacity key={exp.id} style={styles.expRow} onPress={() => router.push({ pathname: '/(tabs)/expense-detail', params: { expenseId: exp.id } })}>
                  <View>
                    <Text style={styles.expTitle}>{exp.title}</Text>
                    <Text style={styles.expDate}>{formatDate(exp.date)}</Text>
                  </View>
                  <Text style={[styles.expAmount, { color: myNet >= 0 ? '#2E7D32' : '#D32F2F' }]}>{myNet >= 0 ? `₹${Math.abs(myNet).toFixed(2)} (Get)` : `₹${Math.abs(myNet).toFixed(2)} (Pay)`}</Text>
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
