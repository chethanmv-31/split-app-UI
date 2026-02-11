import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { api } from '../../services/api';
import { useSession } from '../../ctx';

type AnalyticsState = {
  youOwe: number;
  owesYou: number;
  totalSpent: number;
  transactionCount: number;
  categoryTotals: Record<string, number>;
  groupTotals: Record<string, number>;
};

const initialState: AnalyticsState = {
  youOwe: 0,
  owesYou: 0,
  totalSpent: 0,
  transactionCount: 0,
  categoryTotals: {},
  groupTotals: {},
};

export default function AnalyticsScreen() {
  const { session } = useSession();
  const currentUser = session ? JSON.parse(session) : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsState>(initialState);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [expenseResult, groupResult] = await Promise.all([
        api.getExpenses(),
        api.getGroups(currentUser?.id),
      ]);

      if (!expenseResult.success) return;

      const groupNameById = (groupResult.success ? groupResult.data : []).reduce(
        (acc: Record<string, string>, group: any) => {
          if (group?.id && group?.name) acc[group.id] = group.name;
          return acc;
        },
        {}
      );

      const next: AnalyticsState = {
        youOwe: 0,
        owesYou: 0,
        totalSpent: 0,
        transactionCount: expenseResult.data.length,
        categoryTotals: {},
        groupTotals: {},
      };

      expenseResult.data.forEach((expense: any) => {
        const amount = Number(expense.amount) || 0;
        const splitBetween = expense.splitBetween || [];
        const splitDetails = expense.splitDetails || [];
        const isPaidByMe = expense.paidBy === currentUser?.id;
        const isInSplit = splitBetween.includes(currentUser?.id);

        if (isPaidByMe) next.totalSpent += amount;

        const category = expense.category || 'Others';
        next.categoryTotals[category] = (next.categoryTotals[category] || 0) + amount;

        const groupLabel = expense.groupId ? (groupNameById[expense.groupId] || 'Unnamed Group') : 'Personal';
        next.groupTotals[groupLabel] = (next.groupTotals[groupLabel] || 0) + amount;

        if (isPaidByMe) {
          if (expense.splitType === 'EQUAL') {
            const count = splitBetween.length;
            if (count > 0) {
              const share = amount / count;
              next.owesYou += isInSplit ? share * (count - 1) : amount;
            }
          } else {
            next.owesYou += splitDetails.reduce(
              (acc: number, detail: any) => (detail.userId !== currentUser?.id ? acc + (detail.amount || 0) : acc),
              0
            );
          }
        } else if (isInSplit) {
          if (expense.splitType === 'EQUAL') {
            const count = splitBetween.length;
            if (count > 0) next.youOwe += amount / count;
          } else {
            const myShare = splitDetails.find((detail: any) => detail.userId === currentUser?.id)?.amount || 0;
            next.youOwe += myShare;
          }
        }
      });

      setAnalytics(next);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  }, [fetchData]);

  const topCategories = useMemo(
    () =>
      Object.entries(analytics.categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [analytics.categoryTotals]
  );

  const topGroups = useMemo(
    () =>
      Object.entries(analytics.groupTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [analytics.groupTotals]
  );

  const formatMoney = (value: number) => `\u20B9${value.toFixed(2)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Overall Analytics</Text>
          <Text style={styles.headerSubtitle}>Your complete split expense summary</Text>
        </View>

        <View style={styles.panel}>
          {loading ? (
            <ActivityIndicator size="small" color="#FF8C69" style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={styles.cardsRow}>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>You Pay</Text>
                  <Text style={[styles.cardValue, styles.payColor]}>{formatMoney(analytics.youOwe)}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>You Get</Text>
                  <Text style={[styles.cardValue, styles.getColor]}>{formatMoney(analytics.owesYou)}</Text>
                </View>
              </View>

              <View style={styles.cardsRow}>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Paid By You</Text>
                  <Text style={styles.cardValue}>{formatMoney(analytics.totalSpent)}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Transactions</Text>
                  <Text style={styles.cardValue}>{analytics.transactionCount}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Categories</Text>
                {topCategories.length > 0 ? (
                  topCategories.map(([name, value]) => (
                    <View key={name} style={styles.rowItem}>
                      <Text style={styles.rowLabel}>{name}</Text>
                      <Text style={styles.rowValue}>{formatMoney(value)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No category data yet.</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Groups</Text>
                {topGroups.length > 0 ? (
                  topGroups.map(([name, value]) => (
                    <View key={name} style={styles.rowItem}>
                      <Text style={styles.rowLabel}>{name}</Text>
                      <Text style={styles.rowValue}>{formatMoney(value)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No group data yet.</Text>
                )}
              </View>
            </>
          )}
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
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  panel: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 20,
    minHeight: '100%',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
  },
  cardLabel: {
    color: '#666',
    fontSize: 13,
    marginBottom: 6,
  },
  cardValue: {
    color: '#1E1E1E',
    fontSize: 20,
    fontWeight: '700',
  },
  payColor: {
    color: '#D32F2F',
  },
  getColor: {
    color: '#2E7D32',
  },
  section: {
    marginTop: 16,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1E1E1E',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLabel: {
    color: '#444',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  rowValue: {
    color: '#1E1E1E',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
  },
});
