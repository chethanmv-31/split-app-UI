import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '../services/api';
import { useSession } from '../ctx';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams();
  const { session } = useSession();
  const currentUser = session ? JSON.parse(session) : null;
  const [expense, setExpense] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenseDetails();
  }, [expenseId]);

  const fetchExpenseDetails = async () => {
    try {
      const [expensesRes, usersRes] = await Promise.all([
        api.getExpenses(currentUser?.id),
        api.getUsers()
      ]);

      if (expensesRes.success && usersRes.success) {
        const foundExpense = expensesRes.data.find((e: any) => e.id === expenseId);
        if (foundExpense) {
          setExpense(foundExpense);
          setUsers(usersRes.data);
        }
      }
    } catch (error) {
      console.error('Error fetching expense details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'Food': return { icon: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', color: '#FFF9C4', name: 'Food' };
      case 'Travel': return { icon: 'https://cdn-icons-png.flaticon.com/512/201/201331.png', color: '#E8F5E9', name: 'Travel' };
      case 'Shopping': return { icon: 'https://cdn-icons-png.flaticon.com/512/2838/2838895.png', color: '#FFF3E0', name: 'Shopping' };
      case 'Health': return { icon: 'https://cdn-icons-png.flaticon.com/512/2966/2966488.png', color: '#FCE4EC', name: 'Health' };
      case 'Education': return { icon: 'https://cdn-icons-png.flaticon.com/512/2436/2436636.png', color: '#E3F2FD', name: 'Education' };
      case 'Rent': return { icon: 'https://cdn-icons-png.flaticon.com/512/1946/1946488.png', color: '#F1F8E9', name: 'Rent' };
      case 'Utilities': return { icon: 'https://cdn-icons-png.flaticon.com/512/3079/3079167.png', color: '#FFFDE7', name: 'Utilities' };
      case 'Transport': return { icon: 'https://cdn-icons-png.flaticon.com/512/744/744465.png', color: '#E8EAF6', name: 'Transport' };
      case 'Entertainment': return { icon: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png', color: '#F3E5F5', name: 'Entertainment' };
      case 'Bills': return { icon: 'https://cdn-icons-png.flaticon.com/512/1051/1051275.png', color: '#FFF3E0', name: 'Bills' };
      case 'Others': return { icon: 'https://cdn-icons-png.flaticon.com/512/570/570223.png', color: '#F5F5F5', name: 'Others' };
      default: return { icon: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png', color: '#E1F5FE', name: 'General' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getPayerName = (payerId: string) => {
    const payer = users.find((u: any) => u.id === payerId);
    return payer?.name || 'Unknown';
  };

  const getSplitDetails = () => {
    if (!expense) return [];
    
    const splitBetween = expense.splitBetween || [];
    const splitDetails = expense.splitDetails || [];

    if (expense.splitType === 'EQUAL') {
      const equalShare = expense.amount / splitBetween.length;
      return splitBetween.map((userId: string) => ({
        userId,
        amount: equalShare,
        name: users.find((u: any) => u.id === userId)?.name || 'Unknown'
      }));
    } else {
      return splitDetails.map((detail: any) => ({
        userId: detail.userId,
        amount: detail.amount,
        name: users.find((u: any) => u.id === detail.userId)?.name || 'Unknown'
      }));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expense Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8C69" />
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expense Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#999' }}>Expense not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const theme = getCategoryTheme(expense.category);
  const splitDetails = getSplitDetails();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
          <IconSymbol size={24} name="chevron.left" color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Expense Title and Amount */}
        <View style={styles.mainCard}>
          <View style={[styles.categoryIcon, { backgroundColor: theme.color }]}>
            <Image source={{ uri: theme.icon }} style={styles.categoryImage} />
          </View>
          <Text style={styles.expenseTitle}>{expense.title}</Text>
          <Text style={styles.expenseAmount}>₹{(expense.amount || 0).toFixed(2)}</Text>
          <Text style={styles.categoryName}>{theme.name}</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <IconSymbol size={20} name="calendar" color="#FF8C69" />
              <Text style={styles.infoTitle}>Date</Text>
            </View>
            <Text style={styles.infoValue}>{formatDate(expense.date)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <IconSymbol size={20} name="person.fill" color="#FF8C69" />
              <Text style={styles.infoTitle}>Paid By</Text>
            </View>
            <View style={styles.paidByBadge}>
              <Image 
                source={{ uri: `https://i.pravatar.cc/150?u=${expense.paidBy}` }} 
                style={styles.avatar} 
              />
              <Text style={styles.infoValue}>{getPayerName(expense.paidBy)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <IconSymbol size={20} name="chart.pie.fill" color="#FF8C69" />
              <Text style={styles.infoTitle}>Split Type</Text>
            </View>
            <Text style={styles.infoValue}>{expense.splitType === 'EQUAL' ? 'Equal Split' : 'Unequal Split'}</Text>
          </View>
        </View>

        {/* Split Details */}
        <View style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Split Details</Text>
          
          {splitDetails.map((detail: any, index: number) => (
            <View key={detail.userId}>
              <View style={styles.splitRow}>
                <View style={styles.splitLeft}>
                  <Image 
                    source={{ uri: `https://i.pravatar.cc/150?u=${detail.userId}` }} 
                    style={styles.splitAvatar} 
                  />
                  <View>
                    <Text style={styles.splitName}>
                      {detail.name}
                      {detail.userId === currentUser?.id && ' (You)'}
                    </Text>
                    <Text style={styles.splitRole}>
                      {detail.userId === expense.paidBy ? 'Paid' : 'Owes'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.splitAmount}>₹{detail.amount.toFixed(2)}</Text>
              </View>
              {index < splitDetails.length - 1 && <View style={styles.listDivider} />}
            </View>
          ))}
        </View>

        <View style={{ height: 50 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  content: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
  },
  mainCard: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  categoryIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  expenseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 10,
    textAlign: 'center',
  },
  expenseAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FF8C69',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#1E1E1E',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  paidByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  splitCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 16,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  splitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  splitAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  splitName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1E1E',
  },
  splitRole: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF8C69',
  },
  listDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
  },
});
