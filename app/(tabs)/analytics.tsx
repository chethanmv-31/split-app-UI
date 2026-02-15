import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { api } from '../../services/api';
import { useSession } from '../../ctx';

type AnalyticsState = {
  youOwe: number;
  owesYou: number;
  totalSpent: number;
  transactionCount: number;
  categoryTotals: Record<string, number>;
  groupTotals: Record<string, number>;
  dailyTotals: Record<string, number>;
  monthlyTotals: Record<string, number>;
  settlementTotals: {
    paid: number;
    received: number;
    net: number;
  };
};

type RankedDatum = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
};

type TrendDatum = {
  key: string;
  label: string;
  value: number;
};

type TimeFilter = '30D' | '90D' | 'ALL';

const CHART_COLORS = ['#FF8C69', '#F4B400', '#43A047', '#1E88E5', '#8E24AA', '#0097A7'];
const LINE_CHART_HEIGHT = 190;
const LINE_CHART_PADDING_TOP = 10;
const LINE_CHART_PADDING_HORIZONTAL = 12;
const LINE_CHART_PADDING_BOTTOM = 24;

const toLocalDayKey = (dateObj: Date) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const controlX = (prev.x + curr.x) / 2;
    path += ` C ${controlX} ${prev.y}, ${controlX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
};

const initialState: AnalyticsState = {
  youOwe: 0,
  owesYou: 0,
  totalSpent: 0,
  transactionCount: 0,
  categoryTotals: {},
  groupTotals: {},
  dailyTotals: {},
  monthlyTotals: {},
  settlementTotals: {
    paid: 0,
    received: 0,
    net: 0,
  },
};

export default function AnalyticsScreen() {
  const { session } = useSession();
  const currentUser = useMemo(() => {
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }, [session]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState>(initialState);
  const [groupFilters, setGroupFilters] = useState<Array<{ id: string; name: string }>>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('90D');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [trendGroupBy, setTrendGroupBy] = useState<'daily' | 'monthly'>('monthly');
  const [lineChartWidth, setLineChartWidth] = useState(0);
  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(null);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const exportContentRef = React.useRef<View | null>(null);

  const isWithinRange = useCallback((date: Date) => {
    if (selectedTimeFilter === 'ALL') return true;
    const days = selectedTimeFilter === '30D' ? 30 : 90;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return date.getTime() >= since;
  }, [selectedTimeFilter]);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorMessage(null);
    try {
      const [expenseResult, groupResult] = await Promise.all([
        api.getExpenses(currentUser?.id),
        api.getGroups(currentUser?.id),
      ]);

      if (!expenseResult.success) {
        setAnalytics(initialState);
        setErrorMessage(expenseResult.message || 'Failed to load analytics data.');
        return;
      }

      const groups = groupResult.success ? groupResult.data : [];
      setGroupFilters(groups.map((group: any) => ({ id: group.id, name: group.name })));

      const groupNameById = groups.reduce(
        (acc: Record<string, string>, group: any) => {
          if (group?.id && group?.name) acc[group.id] = group.name;
          return acc;
        },
        {}
      );

      const filteredExpenses = expenseResult.data.filter((expense: any) => {
        const dateObj = new Date(expense.date);
        if (Number.isNaN(dateObj.getTime())) return false;

        if (!isWithinRange(dateObj)) return false;

        if (selectedGroupFilter === 'all') return true;
        if (selectedGroupFilter === 'personal') return !expense.groupId;
        return expense.groupId === selectedGroupFilter;
      });

      if (selectedGroupFilter !== 'personal') {
        const summaryResult = await api.getAnalyticsSummary({
          groupId: selectedGroupFilter === 'all' ? undefined : selectedGroupFilter,
          timeFilter: selectedTimeFilter,
        });
        if (summaryResult.success) {
          setAnalytics({
            ...summaryResult.data,
            settlementTotals: summaryResult.data.settlementTotals || { paid: 0, received: 0, net: 0 },
          });
          return;
        }
      }

      const next: AnalyticsState = {
        youOwe: 0,
        owesYou: 0,
        totalSpent: 0,
        transactionCount: filteredExpenses.length,
        categoryTotals: {},
        groupTotals: {},
        dailyTotals: {},
        monthlyTotals: {},
        settlementTotals: { paid: 0, received: 0, net: 0 },
      };

      filteredExpenses.forEach((expense: any) => {
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

        const dateObj = new Date(expense.date);
        const dayKey = Number.isNaN(dateObj.getTime()) ? 'Unknown' : toLocalDayKey(dateObj);
        next.dailyTotals[dayKey] = (next.dailyTotals[dayKey] || 0) + amount;

        const monthKey = Number.isNaN(dateObj.getTime()) ? 'Unknown' : `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        next.monthlyTotals[monthKey] = (next.monthlyTotals[monthKey] || 0) + amount;

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
      setAnalytics(initialState);
      setErrorMessage('Could not load analytics right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, isWithinRange, selectedGroupFilter]);

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

  const formatMoney = (value: number) => `\u20B9${value.toFixed(2)}`;
  const formatCompactMoney = (value: number) => {
    if (value >= 1000000) return `\u20B9${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `\u20B9${(value / 1000).toFixed(1)}K`;
    return `\u20B9${Math.round(value)}`;
  };

  const categoryChart = useMemo<RankedDatum[]>(() => {
    const total = Object.values(analytics.categoryTotals).reduce((acc, value) => acc + value, 0);
    return Object.entries(analytics.categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value], index) => ({
        key,
        label: key,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [analytics.categoryTotals]);

  const groupChart = useMemo<RankedDatum[]>(() => {
    const total = Object.values(analytics.groupTotals).reduce((acc, value) => acc + value, 0);
    return Object.entries(analytics.groupTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value], index) => ({
        key,
        label: key,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [analytics.groupTotals]);

  const monthlyGraph = useMemo<TrendDatum[]>(() => {
    const entries = Object.entries(analytics.monthlyTotals)
      .filter(([key]) => key !== 'Unknown')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, value]) => {
        const [year, month] = key.split('-').map((x) => Number(x));
        const dateObj = new Date(year, (month || 1) - 1, 1);
        return {
          key,
          label: Number.isNaN(dateObj.getTime())
            ? key
            : dateObj.toLocaleDateString('en-US', { month: 'short' }),
          value,
        };
      });

    return entries;
  }, [analytics.monthlyTotals]);

  const dailyGraph = useMemo<TrendDatum[]>(() => {
    const entries = Object.entries(analytics.dailyTotals)
      .filter(([key]) => key !== 'Unknown')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([key, value]) => {
        const [year, month, day] = key.split('-').map((item) => Number(item));
        const dateObj = new Date(year, (month || 1) - 1, day || 1);
        return {
          key,
          label: Number.isNaN(dateObj.getTime())
            ? key
            : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value,
        };
      });

    return entries;
  }, [analytics.dailyTotals]);

  const trendGraph = trendGroupBy === 'daily' ? dailyGraph : monthlyGraph;
  const trendSecondaryGraph = useMemo<TrendDatum[]>(() => {
    return trendGraph.map((point, index, arr) => {
      const prev = arr[index - 1]?.value ?? point.value;
      const next = arr[index + 1]?.value ?? point.value;
      return {
        key: `${point.key}-smooth`,
        label: point.label,
        value: (prev + point.value + next) / 3,
      };
    });
  }, [trendGraph]);

  const maxGroupValue = Math.max(...groupChart.map((item) => item.value), 1);
  const maxTrendValue = Math.max(
    ...trendGraph.map((item) => item.value),
    ...trendSecondaryGraph.map((item) => item.value),
    1
  );
  const chartPlotHeight = LINE_CHART_HEIGHT - LINE_CHART_PADDING_TOP - LINE_CHART_PADDING_BOTTOM;

  const trendPrimaryPoints = useMemo(() => {
    if (!lineChartWidth || trendGraph.length === 0) return [];
    const usableWidth = Math.max(lineChartWidth - LINE_CHART_PADDING_HORIZONTAL * 2, 1);
    return trendGraph.map((point, index, arr) => {
      const x = LINE_CHART_PADDING_HORIZONTAL + (arr.length === 1 ? usableWidth / 2 : (usableWidth * index) / (arr.length - 1));
      const y = LINE_CHART_PADDING_TOP + chartPlotHeight * (1 - point.value / maxTrendValue);
      return { ...point, x, y };
    });
  }, [lineChartWidth, trendGraph, chartPlotHeight, maxTrendValue]);

  const trendSecondaryPoints = useMemo(() => {
    if (!lineChartWidth || trendSecondaryGraph.length === 0) return [];
    const usableWidth = Math.max(lineChartWidth - LINE_CHART_PADDING_HORIZONTAL * 2, 1);
    return trendSecondaryGraph.map((point, index, arr) => {
      const x = LINE_CHART_PADDING_HORIZONTAL + (arr.length === 1 ? usableWidth / 2 : (usableWidth * index) / (arr.length - 1));
      const y = LINE_CHART_PADDING_TOP + chartPlotHeight * (1 - point.value / maxTrendValue);
      return { ...point, x, y };
    });
  }, [lineChartWidth, trendSecondaryGraph, chartPlotHeight, maxTrendValue]);

  const yAxisTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const ratio = index / steps;
      const value = maxTrendValue * (1 - ratio);
      const y = LINE_CHART_PADDING_TOP + chartPlotHeight * ratio;
      return { value, y };
    });
  }, [chartPlotHeight, maxTrendValue]);

  useEffect(() => {
    if (trendGraph.length === 0) {
      setSelectedTrendKey(null);
      return;
    }

    const hasSelection = selectedTrendKey && trendGraph.some((item) => item.key === selectedTrendKey);
    if (!hasSelection) setSelectedTrendKey(trendGraph[trendGraph.length - 1].key);
  }, [trendGraph, selectedTrendKey]);

  const selectedTrendPoint = useMemo(
    () => trendGraph.find((item) => item.key === selectedTrendKey) || null,
    [trendGraph, selectedTrendKey]
  );

  const handleExportPdf = useCallback(async () => {
    if (isExportingPdf) return;

    setIsGroupDropdownOpen(false);
    setIsExportingPdf(true);

    try {
      let captureRef: any;
      let Print: any;
      let Sharing: any;

      try {
        captureRef = require('react-native-view-shot').captureRef;
        Print = require('expo-print');
        Sharing = require('expo-sharing');
      } catch {
        Alert.alert(
          'Missing packages',
          'Install: expo-print expo-sharing react-native-view-shot',
        );
        return;
      }

      if (!scrollRef.current) {
        Alert.alert('Export failed', 'Screen is not ready for export.');
        return;
      }

      const { width: windowWidth } = Dimensions.get('window');
      const captureTarget = exportContentRef.current || scrollRef.current;

      if (!captureTarget) {
        Alert.alert('Export failed', 'Screen is not ready for export.');
        return;
      }

      const fallbackHeight = windowWidth * 2;
      const measuredHeight = scrollContentHeight > 0 ? scrollContentHeight : fallbackHeight;

      const imageDataUri = await captureRef(captureTarget, {
        format: 'png',
        quality: 1,
        result: 'data-uri',
      });

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#ffffff;">
            <img src="${imageDataUri}" style="width:100%;height:auto;display:block;" />
          </body>
        </html>
      `;

      const pdfWidth = 595;
      const pdfHeight = Math.max(842, Math.round((measuredHeight / Math.max(windowWidth, 1)) * pdfWidth));
      const { uri } = await Print.printToFileAsync({ html, width: pdfWidth, height: pdfHeight });

      if (Sharing?.isAvailableAsync && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Analytics PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF exported', `Saved at:\n${uri}`);
      }
    } catch (error: any) {
      const reason = error?.message ? `\n\nReason: ${error.message}` : '';
      Alert.alert('Export failed', `Could not generate analytics PDF.${reason}`);
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf]);

  const groupOptions = useMemo(
    () => [
      { id: 'all', name: 'All Groups' },
      { id: 'personal', name: 'Personal' },
      ...groupFilters,
    ],
    [groupFilters]
  );

  const selectedGroupLabel = useMemo(
    () => groupOptions.find((option) => option.id === selectedGroupFilter)?.name || 'All Groups',
    [groupOptions, selectedGroupFilter]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onContentSizeChange={(_, height) => setScrollContentHeight(height)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C69']} />}
      >
        <View ref={exportContentRef} collapsable={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Overall Analytics</Text>
          <Text style={styles.headerSubtitle}>Your complete split expense summary</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.filterSection}>
            <View style={styles.segmentedControl}>
              {(['30D', '90D', 'ALL'] as TimeFilter[]).map((filterKey) => (
                <Pressable
                  key={filterKey}
                  style={[styles.segmentedControlBtn, selectedTimeFilter === filterKey && styles.segmentedControlBtnActive]}
                  onPress={() => setSelectedTimeFilter(filterKey)}
                >
                  <Text style={[styles.segmentedControlText, selectedTimeFilter === filterKey && styles.segmentedControlTextActive]}>
                    {filterKey === 'ALL' ? 'All Time' : filterKey}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.dropdownWrap}>
              <Pressable style={styles.dropdownButton} onPress={() => setIsGroupDropdownOpen((prev) => !prev)}>
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {selectedGroupLabel}
                </Text>
                <Text style={styles.dropdownCaret}>{isGroupDropdownOpen ? '▲' : '▼'}</Text>
              </Pressable>

              {isGroupDropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  {groupOptions.map((group) => (
                    <Pressable
                      key={group.id}
                      style={[styles.dropdownItem, selectedGroupFilter === group.id && styles.dropdownItemActive]}
                      onPress={() => {
                        setSelectedGroupFilter(group.id);
                        setIsGroupDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, selectedGroupFilter === group.id && styles.dropdownItemTextActive]}>
                        {group.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable style={styles.exportLinkWrap} onPress={handleExportPdf} disabled={isExportingPdf}>
              <Text style={[styles.exportLinkText, isExportingPdf && styles.exportLinkTextDisabled]}>
                {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
              </Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator size="small" color="#FF8C69" style={{ marginVertical: 24 }} />
          ) : analytics.transactionCount === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No analytics data for this filter</Text>
              <Text style={styles.emptySubtitle}>Try another time range or group.</Text>
            </View>
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

              <View style={styles.cardsRow}>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Settled (Paid)</Text>
                  <Text style={styles.cardValue}>{formatMoney(analytics.settlementTotals.paid)}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Settled (Received)</Text>
                  <Text style={styles.cardValue}>{formatMoney(analytics.settlementTotals.received)}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                {categoryChart.length > 0 ? (
                  <>
                    <View style={styles.pieCircle}>
                      <Text style={styles.pieCenterLabel}>Total</Text>
                      <Text style={styles.pieCenterValue}>{formatMoney(Object.values(analytics.categoryTotals).reduce((acc, value) => acc + value, 0))}</Text>
                    </View>

                    <View style={styles.pieTrack}>
                      {categoryChart.map((slice, index) => (
                        <View
                          key={slice.key}
                          style={[
                            styles.pieSegment,
                            {
                              backgroundColor: slice.color,
                              flex: Math.max(slice.value, 0.001),
                              borderTopLeftRadius: index === 0 ? 10 : 0,
                              borderBottomLeftRadius: index === 0 ? 10 : 0,
                              borderTopRightRadius: index === categoryChart.length - 1 ? 10 : 0,
                              borderBottomRightRadius: index === categoryChart.length - 1 ? 10 : 0,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    {categoryChart.map((slice) => (
                      <View key={`legend-${slice.key}`} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                        <Text style={styles.legendLabel}>{slice.label}</Text>
                        <Text style={styles.legendValue}>{slice.percentage.toFixed(1)}%</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.emptyText}>No category data yet.</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Group Spending Comparison</Text>
                {groupChart.length > 0 ? (
                  groupChart.map((item) => (
                    <View key={`bar-${item.key}`} style={styles.barRow}>
                      <View style={styles.barRowTop}>
                        <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
                        <Text style={styles.barValue}>{formatMoney(item.value)}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(item.value / maxGroupValue) * 100}%` }]} />
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No group data yet.</Text>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Spending Trend</Text>
                  <View style={styles.trendToggle}>
                    <Pressable
                      style={[styles.trendToggleBtn, trendGroupBy === 'daily' && styles.trendToggleBtnActive]}
                      onPress={() => setTrendGroupBy('daily')}
                    >
                      <Text style={[styles.trendToggleText, trendGroupBy === 'daily' && styles.trendToggleTextActive]}>Days</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.trendToggleBtn, trendGroupBy === 'monthly' && styles.trendToggleBtnActive]}
                      onPress={() => setTrendGroupBy('monthly')}
                    >
                      <Text style={[styles.trendToggleText, trendGroupBy === 'monthly' && styles.trendToggleTextActive]}>Months</Text>
                    </Pressable>
                  </View>
                </View>
                {trendGraph.length > 0 ? (
                  <>
                    <View style={styles.lineChartWrap}>
                      <View style={styles.lineChartMain}>
                        <View
                          style={styles.lineChartArea}
                          onLayout={(event) => setLineChartWidth(event.nativeEvent.layout.width)}
                        >
                          <View style={styles.yAxisOverlay}>
                            {yAxisTicks.map((tick, index) => (
                              <Text key={`tick-${index}`} style={[styles.yAxisLabel, { top: tick.y - 8 }]}>
                                {formatCompactMoney(tick.value)}
                              </Text>
                            ))}
                          </View>
                          <Svg width="100%" height={LINE_CHART_HEIGHT}>
                            {yAxisTicks.map((tick, index) => (
                              <Line
                                key={`grid-${index}`}
                                x1={LINE_CHART_PADDING_HORIZONTAL}
                                y1={tick.y}
                                x2={Math.max(lineChartWidth - LINE_CHART_PADDING_HORIZONTAL, LINE_CHART_PADDING_HORIZONTAL)}
                                y2={tick.y}
                                stroke="#E8E8E8"
                                strokeWidth={1}
                              />
                            ))}
                            <Path
                              d={buildSmoothPath(trendSecondaryPoints)}
                              stroke="#21C17A"
                              strokeWidth={3}
                              fill="none"
                            />
                            <Path
                              d={buildSmoothPath(trendPrimaryPoints)}
                              stroke="#1E88E5"
                              strokeWidth={3}
                              fill="none"
                            />
                            {trendPrimaryPoints.map((point) => (
                              <React.Fragment key={`point-${point.key}`}>
                                <Circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={selectedTrendKey === point.key ? 5 : 3}
                                  fill={selectedTrendKey === point.key ? '#FF8C69' : '#1E88E5'}
                                />
                                <Circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={12}
                                  fill="transparent"
                                  onPress={() => setSelectedTrendKey(point.key)}
                                />
                              </React.Fragment>
                            ))}
                          </Svg>
                        </View>
                        <View style={styles.xAxisRow}>
                          {trendGraph.map((point) => (
                            <View key={`x-${point.key}`} style={styles.xAxisItem}>
                              <Text style={styles.graphLabel}>{point.label}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.chartLegendRow}>
                          <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: '#1E88E5' }]} />
                            <Text style={styles.chartLegendText}>Actual</Text>
                          </View>
                          <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: '#21C17A' }]} />
                            <Text style={styles.chartLegendText}>Smoothed</Text>
                          </View>
                        </View>
                        {selectedTrendPoint ? (
                          <View style={styles.selectedPointCard}>
                            <Text style={styles.selectedPointLabel}>Selected point</Text>
                            <Text style={styles.selectedPointValue}>
                              {selectedTrendPoint.label}: {formatMoney(selectedTrendPoint.value)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No {trendGroupBy === 'daily' ? 'daily' : 'monthly'} trend data yet.</Text>
                )}
              </View>
            </>
          )}
        </View>
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
  filterSection: {
    marginBottom: 10,
    gap: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#ECECEC',
    borderRadius: 12,
    padding: 4,
  },
  segmentedControlBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentedControlBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentedControlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  segmentedControlTextActive: {
    color: '#FF8C69',
  },
  dropdownWrap: {
    position: 'relative',
    zIndex: 20,
  },
  dropdownButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginRight: 10,
  },
  dropdownCaret: {
    fontSize: 11,
    color: '#666',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dropdownItemActive: {
    backgroundColor: '#FFF3ED',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#FF8C69',
  },
  exportLinkWrap: {
    marginTop: 2,
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  exportLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E88E5',
  },
  exportLinkTextDisabled: {
    color: '#9CB7DF',
  },
  errorBox: {
    backgroundColor: '#FCE8E6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  errorText: {
    color: '#A33A2B',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trendToggle: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  trendToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  trendToggleBtnActive: {
    backgroundColor: '#FF8C69',
  },
  trendToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  trendToggleTextActive: {
    color: '#FFFFFF',
  },
  pieCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF3ED',
    borderWidth: 10,
    borderColor: '#FFCFBE',
    marginBottom: 12,
  },
  pieCenterLabel: {
    fontSize: 12,
    color: '#8A6B5D',
  },
  pieCenterValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#1E1E1E',
    fontWeight: '700',
  },
  pieTrack: {
    flexDirection: 'row',
    width: '100%',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  pieSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: '#444',
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  barRow: {
    marginBottom: 12,
  },
  barRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    color: '#444',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  barValue: {
    color: '#1E1E1E',
    fontSize: 13,
    fontWeight: '600',
  },
  barTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#FF8C69',
  },
  lineChartWrap: {
    width: '100%',
  },
  yAxisLabel: {
    position: 'absolute',
    left: 6,
    fontSize: 10,
    color: '#7A7A7A',
    fontWeight: '600',
  },
  yAxisOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    pointerEvents: 'none',
  },
  lineChartMain: {
    width: '100%',
  },
  lineChartArea: {
    height: LINE_CHART_HEIGHT,
    backgroundColor: '#FCFCFC',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 12,
    overflow: 'hidden',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 6,
  },
  xAxisItem: {
    flex: 1,
    alignItems: 'center',
  },
  graphValue: {
    marginTop: 8,
    color: '#1E1E1E',
    fontSize: 10,
    fontWeight: '600',
  },
  chartLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  chartLegendText: {
    color: '#444',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedPointCard: {
    marginTop: 10,
    backgroundColor: '#FFF3ED',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectedPointLabel: {
    fontSize: 11,
    color: '#8A6B5D',
    fontWeight: '600',
  },
  selectedPointValue: {
    marginTop: 2,
    fontSize: 13,
    color: '#1E1E1E',
    fontWeight: '700',
  },
  graphLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
  },
});
