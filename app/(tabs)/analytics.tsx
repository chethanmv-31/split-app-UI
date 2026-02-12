import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { api } from '../../services/api';
import { useSession } from '../../ctx';

type ChartDatum = {
  label: string;
  value: number;
  count: number;
  color: string;
};

type AnalyticsState = {
  youOwe: number;
  owesYou: number;
  totalSpent: number;
  transactionCount: number;
  categoryTotals: Record<string, number>;
  categoryCounts: Record<string, number>;
  payerTotals: Record<string, number>;
  payerCounts: Record<string, number>;
  groupTotals: Record<string, number>;
};

const initialState: AnalyticsState = {
  youOwe: 0,
  owesYou: 0,
  totalSpent: 0,
  transactionCount: 0,
  categoryTotals: {},
  categoryCounts: {},
  payerTotals: {},
  payerCounts: {},
  groupTotals: {},
};

const CHART_COLORS = ['#FF8C69', '#64B5F6', '#66BB6A', '#FFD54F', '#BA68C8', '#4DD0E1'];

const formatMoney = (value: number) => `\u20B9${value.toFixed(2)}`;

const toChartData = (
  totals: Record<string, number>,
  counts: Record<string, number>,
  limit = 5
): ChartDatum[] => {
  const sorted = Object.entries(totals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  const top = sorted.slice(0, limit).map(([label, value], index) => ({
    label,
    value,
    count: counts[label] || 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (sorted.length <= limit) return top;

  const others = sorted.slice(limit).reduce(
    (acc, [label, value]) => {
      acc.value += value;
      acc.count += counts[label] || 0;
      return acc;
    },
    { value: 0, count: 0 }
  );

  return [
    ...top,
    {
      label: 'Others',
      value: others.value,
      count: others.count,
      color: '#BDBDBD',
    },
  ];
};

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const donutPath = (cx: number, cy: number, outerR: number, innerR: number, start: number, end: number) => {
  const largeArc = end - start > 180 ? 1 : 0;
  const outerStart = polar(cx, cy, outerR, start);
  const outerEnd = polar(cx, cy, outerR, end);
  const innerStart = polar(cx, cy, innerR, start);
  const innerEnd = polar(cx, cy, innerR, end);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

function PieCard({ title, subtitle, data }: { title: string; subtitle: string; data: ChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const size = 180;
  const center = size / 2;
  const outerR = 80;
  const innerR = 45;
  let angleStart = -90;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>

      {total > 0 ? (
        <>
          <View style={styles.chartWrap}>
            <Svg width={size} height={size}>
              {data.length === 1 ? (
                <Circle cx={center} cy={center} r={outerR} fill={data[0].color} />
              ) : (
                data.map((item) => {
                  const sweep = (item.value / total) * 360;
                  const angleEnd = angleStart + sweep;
                  const d = donutPath(center, center, outerR, innerR, angleStart, angleEnd);
                  angleStart = angleEnd;
                  return <Path key={item.label} d={d} fill={item.color} />;
                })
              )}
              <Circle cx={center} cy={center} r={innerR} fill="white" />
            </Svg>
            <View style={styles.chartCenterLabel}>
              <Text style={styles.chartCenterTitle}>Total</Text>
              <Text style={styles.chartCenterValue}>{formatMoney(total)}</Text>
            </View>
          </View>

          {data.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View key={`legend-${title}-${item.label}`} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <View style={styles.legendTextWrap}>
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendMeta}>{item.count} expenses</Text>
                </View>
                <View style={styles.legendValueWrap}>
                  <Text style={styles.legendValue}>{formatMoney(item.value)}</Text>
                  <Text style={styles.legendPercent}>{percentage.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.emptyText}>No data yet.</Text>
      )}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { session } = useSession();
  const currentUser = session ? JSON.parse(session) : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsState>(initialState);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [expenseResult, groupResult, usersResult] = await Promise.all([
        api.getExpenses(),
        api.getGroups(currentUser?.id),
        api.getUsers(),
      ]);

      if (!expenseResult.success) return;

      const usersById = (usersResult.success ? usersResult.data : []).reduce(
        (acc: Record<string, string>, user: any) => {
          if (user?.id && user?.name) acc[user.id] = user.name;
          return acc;
        },
        {}
      );

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
        categoryCounts: {},
        payerTotals: {},
        payerCounts: {},
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
        next.categoryCounts[category] = (next.categoryCounts[category] || 0) + 1;

        const payerLabel = usersById[expense.paidBy] || (expense.paidBy ? `User ${String(expense.paidBy).slice(0, 4)}` : 'Unknown');
        next.payerTotals[payerLabel] = (next.payerTotals[payerLabel] || 0) + amount;
        next.payerCounts[payerLabel] = (next.payerCounts[payerLabel] || 0) + 1;

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

  const categoryPieData = useMemo(
    () => toChartData(analytics.categoryTotals, analytics.categoryCounts),
    [analytics.categoryCounts, analytics.categoryTotals]
  );

  const payerPieData = useMemo(
    () => toChartData(analytics.payerTotals, analytics.payerCounts),
    [analytics.payerCounts, analytics.payerTotals]
  );

  const topGroups = useMemo(
    () =>
      Object.entries(analytics.groupTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [analytics.groupTotals]
  );

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

              <PieCard
                title="Category Pie Chart"
                subtitle="Detailed breakdown of overall spending by category"
                data={categoryPieData}
              />

              <PieCard
                title="Spender Pie Chart"
                subtitle="Detailed breakdown of who paid overall expenses"
                data={payerPieData}
              />

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
  sectionSubtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  chartCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartCenterTitle: {
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
  },
  chartCenterValue: {
    color: '#1E1E1E',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  legendMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  legendValueWrap: {
    alignItems: 'flex-end',
  },
  legendValue: {
    color: '#222',
    fontSize: 13,
    fontWeight: '700',
  },
  legendPercent: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
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
