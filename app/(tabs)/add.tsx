import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView } from 'react-native';
import { useSession } from '../../ctx';
import { api } from '../../services/api';
import { Colors } from '../../constants/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
// ...existing code...
import { useContacts } from '../../hooks/useContacts';

export default function AddScreen() {
    const { session } = useSession();
    const router = useRouter();
    const currentUser = session ? JSON.parse(session) : null;
    const { source, groupId, groupName, groupMembers } = useLocalSearchParams<{
        source?: string | string[];
        groupId?: string | string[];
        groupName?: string | string[];
        groupMembers?: string | string[];
    }>();
    const { contacts, hasPermission } = useContacts();

    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [splitType, setSplitType] = useState<'EQUAL' | 'UNEQUAL'>('EQUAL');
    const [individualAmounts, setIndividualAmounts] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [invitedUsersMap, setInvitedUsersMap] = useState<{ [key: string]: { name: string; mobile?: string } }>({});
    const [paidBy, setPaidBy] = useState<string>('');
    const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inviting, setInviting] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const [splitSectionY, setSplitSectionY] = useState(0);

    const parsedSource = Array.isArray(source) ? source[0] : source;
    const parsedGroupId = Array.isArray(groupId) ? groupId[0] : groupId;
    const parsedGroupName = Array.isArray(groupName) ? groupName[0] : groupName;
    const parsedGroupMembers = Array.isArray(groupMembers) ? groupMembers[0] : groupMembers;
    const isGroupExpense = parsedSource === 'group' && Boolean(parsedGroupId);
    const groupMemberIds = useMemo(
        () =>
            (parsedGroupMembers || '')
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
        [parsedGroupMembers]
    );
    const defaultSelectedUsers = useMemo(() => {
        if (!isGroupExpense) {
            return currentUser?.id ? [currentUser.id] : [];
        }
        const ids = new Set(groupMemberIds);
        if (currentUser?.id) {
            ids.add(currentUser.id);
        }
        return Array.from(ids);
    }, [isGroupExpense, groupMemberIds, currentUser?.id]);

    const handleBackPress = useCallback(() => {
        if (isGroupExpense && parsedGroupId) {
            router.replace({
                pathname: '/(tabs)/group-expenses',
                params: {
                    groupId: parsedGroupId,
                    groupName: parsedGroupName,
                    groupMembers: parsedGroupMembers,
                },
            });
            return;
        }

        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)');
    }, [isGroupExpense, parsedGroupId, parsedGroupMembers, parsedGroupName, router]);

    const resetForm = useCallback(() => {
        setTitle('');
        setAmount('');
        setCategory('General');
        setSplitType('EQUAL');
        setIndividualAmounts({});
        setIsPayerDropdownOpen(false);
        setSearchQuery('');
        setInvitedUsersMap({});
        if (currentUser?.id) {
            setPaidBy(currentUser.id);
            setSelectedUsers(defaultSelectedUsers);
        }
    }, [currentUser?.id, defaultSelectedUsers]);

    useFocusEffect(
        useCallback(() => {
            resetForm();
        }, [resetForm])
    );

    // ...existing code...

    const categories = [
        { name: 'General', icon: 'cart.fill' },
        { name: 'Food', icon: 'fork.knife' },
        { name: 'Travel', icon: 'airplane' },
        { name: 'Entertainment', icon: 'tv.fill' },
        { name: 'Bills', icon: 'doc.plaintext.fill' },
        { name: 'Others', icon: 'ellipsis.circle.fill' }
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const result = await api.getUsers();
        if (result.success) {
            setAllUsers(result.data);
            const groupMembersSet = new Set(defaultSelectedUsers);
            const filteredUsers = result.data.filter(
                (u: any) => u.id !== currentUser?.id && (!isGroupExpense || groupMembersSet.has(u.id))
            );
            setUsers(filteredUsers);
        }
    };

    const toggleUserSelection = (userId: string) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
            const newAmounts = { ...individualAmounts };
            delete newAmounts[userId];
            setIndividualAmounts(newAmounts);
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    const handleAmountChange = (userId: string, val: string) => {
        setIndividualAmounts({
            ...individualAmounts,
            [userId]: val
        });
    };

    const validateSplit = () => {
        if (splitType === 'EQUAL') return true;

        const total = parseFloat(amount) || 0;
        const sum = Object.values(individualAmounts).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);

        // Include selected users portion in Unequal split
        return Math.abs(total - sum) < 0.01;
    };

    const normalizePhone = (phone?: string): string => {
        if (!phone) return '';
        return phone.replace(/^\+91/, '').replace(/\s/g, '').trim();
    };

    const handleInviteUser = async (contactName?: string, contactPhone?: string) => {
        if (isGroupExpense) {
            Alert.alert('Group Expense', 'Only group members can be part of this expense.');
            return;
        }

        const name = contactName || searchQuery.trim();
        const phone = contactPhone;

        if (!name) return;

        // Check if phone number already exists in our users list
        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            const existingUser = allUsers.find(u => normalizePhone(u.mobile) === normalizedPhone);
            
            if (existingUser) {
                Alert.alert('Already Added', `This contact is already in your split list as "${existingUser.name}".`);
                setInviting(false);
                return;
            }
        }

        setInviting(true);
        // Check if it's a mobile number or name
        const isMobile = /^\d{10}$/.test(name);

        const result = await api.inviteUser({
            name: isMobile ? `User ${name.slice(-4)}` : name,
            mobile: phone || (isMobile ? name : undefined)
        });

        if (result.success) {
            const newUser = result.data;
            setAllUsers(prev => [...prev, newUser]);
            setUsers(prev => [...prev, newUser]);
            setSelectedUsers(prev => [...prev, newUser.id]);
            // Track the invited user data
            setInvitedUsersMap(prev => ({
                ...prev,
                [newUser.id]: {
                    name: newUser.name,
                    mobile: newUser.mobile
                }
            }));
            setSearchQuery('');
            Alert.alert('Success', `${newUser.name} has been added and selected!`);
        } else {
            Alert.alert('Error', result.message || 'Failed to invite user');
        }
        setInviting(false);
    };

    const handleAddExpense = async () => {
        if (!title || !amount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }

        if (splitType === 'UNEQUAL' && !validateSplit()) {
            const sum = Object.values(individualAmounts).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
            Alert.alert('Error', `Individual amounts (₹${sum.toFixed(2)}) must sum up to total (₹${amount})`);
            return;
        }

        if (selectedUsers.length === 0) {
            Alert.alert('Error', 'Please select at least one person for the split');
            return;
        }

        setLoading(true);
        const splitBetween = selectedUsers;

        const expenseData: any = {
            title,
            amount: parseFloat(amount),
            date: new Date().toISOString(),
            category,
            paidBy: paidBy || currentUser?.id,
            splitType,
            splitBetween,
        };

        if (isGroupExpense && parsedGroupId) {
            expenseData.groupId = parsedGroupId;
        }

        // Include invited users data
        if (!isGroupExpense && Object.keys(invitedUsersMap).length > 0) {
            expenseData.invitedUsers = Object.values(invitedUsersMap);
        }

        if (splitType === 'UNEQUAL') {
            expenseData.splitDetails = splitBetween.map(uid => ({
                userId: uid,
                amount: parseFloat(individualAmounts[uid] || '0')
            }));
        }

        const result = await api.addExpense(expenseData, currentUser?.id);

        if (result.success) {
            setLoading(false);
            Alert.alert('Success', 'Expense added successfully', [
                {
                    text: 'OK',
                    onPress: () => {
                        if (isGroupExpense && parsedGroupId) {
                            router.replace({
                                pathname: '/(tabs)/group-expenses',
                                params: {
                                    groupId: parsedGroupId,
                                    groupName: parsedGroupName,
                                    groupMembers: parsedGroupMembers,
                                },
                            });
                            return;
                        }
                        router.replace('/(tabs)');
                    },
                }
            ]);
            resetForm();
        } else {
            setLoading(false);
            Alert.alert('Error', result.message || 'Failed to add expense');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                    <IconSymbol size={24} name="chevron.left" color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isGroupExpense ? `Add ${parsedGroupName || 'Group'} Expense` : 'Add Expense'}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>What was it for?</Text>
                            <View style={styles.inputWrapper}>
                                <IconSymbol size={20} name="pencil" color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Expense Title"
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>How much?</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.currencySymbol}>₹</Text>
                                <TextInput
                                    style={[styles.input, styles.amountInput]}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>
                    </View>

                    <View
                        style={styles.splitHeader}
                        onLayout={(e) => setSplitSectionY(e.nativeEvent.layout.y)}
                    >
                        <Text style={styles.sectionTitle}>Split With</Text>
                        <View style={styles.splitToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, splitType === 'EQUAL' && styles.toggleBtnActive]}
                                onPress={() => setSplitType('EQUAL')}
                            >
                                <Text style={[styles.toggleText, splitType === 'EQUAL' && styles.toggleTextActive]}>Equal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, splitType === 'UNEQUAL' && styles.toggleBtnActive]}
                                onPress={() => setSplitType('UNEQUAL')}
                            >
                                <Text style={[styles.toggleText, splitType === 'UNEQUAL' && styles.toggleTextActive]}>Unequal</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.searchContainer}>
                        <IconSymbol size={18} name="magnifyingglass" color="#999" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={isGroupExpense ? 'Search group members...' : 'Search by name or mobile...'}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#999"
                            autoFocus={false}
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollTo({ y: splitSectionY - 10, animated: true });
                                }, 100);
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <IconSymbol size={18} name="xmark.circle.fill" color="#CCC" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.usersList}>
                        {/* Merge existing users and contacts, filter by search */}
                        {[
                            currentUser,
                            ...users,
                            ...(!isGroupExpense && searchQuery.length > 0 ? contacts.filter(contact =>
                                !allUsers.some(u => normalizePhone(u.mobile) === normalizePhone(contact.phoneNumber)) &&
                                (contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (contact.phoneNumber && contact.phoneNumber.includes(searchQuery)))
                            ) : [])
                        ]
                            .filter(u => {
                                if (!u) return false;

                                const isContact = Boolean((u as any).isContact);
                                if (!isContact) return true;

                                return searchQuery.length > 0 && (
                                    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    ((u as any).phoneNumber && (u as any).phoneNumber.includes(searchQuery))
                                );
                            })
                            .map((user) => {
                                const isMainUser = user.id === currentUser?.id;
                                const isSelected = selectedUsers.includes(user.id);
                                const isContact = (user as any).isContact;

                                return (
                                    <View key={user.id || (user as any).phoneNumber} style={styles.userContainer}>
                                        <TouchableOpacity
                                            style={[
                                                styles.userItem,
                                                isSelected && styles.userItemSelected,
                                            ]}
                                            onPress={() => {
                                                if (isContact) {
                                                    // Invite contact
                                                    handleInviteUser(user.name, (user as any).phoneNumber);
                                                } else {
                                                    toggleUserSelection(user.id);
                                                }
                                            }}
                                        >
                                            <View style={[styles.userAvatar, isMainUser && styles.userAvatarMe, isContact && styles.userAvatarContact]}>
                                                <Text style={[styles.userAvatarText, isMainUser && { color: 'white' }, isContact && { color: '#FF8C69' }]}>
                                                    {isMainUser ? 'Me' : user.name.charAt(0)}
                                                </Text>
                                                {isSelected && (
                                                    <View style={styles.checkBadge}>
                                                        <IconSymbol size={12} name="checkmark" color="white" />
                                                    </View>
                                                )}
                                                {isContact && (
                                                    <View style={styles.contactBadge}>
                                                        <IconSymbol size={10} name="phone.fill" color="white" />
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.userName} numberOfLines={1}>
                                                {isMainUser ? 'You' : user.name}
                                            </Text>
                                            {isContact && (user as any).phoneNumber && (
                                                <Text style={styles.userPhone} numberOfLines={1}>
                                                    {(user as any).phoneNumber}
                                                </Text>
                                            )}
                                        </TouchableOpacity>

                                        {splitType === 'UNEQUAL' && isSelected && !isContact && (
                                            <View style={styles.individualInputWrapper}>
                                                <Text style={styles.miniCurrency}>₹</Text>
                                                <TextInput
                                                    style={styles.individualInput}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    value={individualAmounts[user.id] || ''}
                                                    onChangeText={(val) => handleAmountChange(user.id, val)}
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}

                        {!isGroupExpense &&
                            searchQuery.length > 2 &&
                            !users.some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (u.mobile && u.mobile.includes(searchQuery))) &&
                            !contacts.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (c.phoneNumber && c.phoneNumber.includes(searchQuery))) && (
                                <TouchableOpacity
                                    style={styles.inviteCard}
                                    onPress={() => handleInviteUser()}
                                    disabled={inviting}
                                >
                                    <View style={styles.inviteIconWrapper}>
                                        {inviting ? <ActivityIndicator size="small" color="#FF8C69" /> : <IconSymbol size={24} name="person.badge.plus" color="#FF8C69" />}
                                    </View>
                                    <View>
                                        <Text style={styles.inviteTitle}>Invite "{searchQuery}"</Text>
                                        <Text style={styles.inviteSub}>User not found. Tap to add.</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                    </View>

                    <View style={[styles.splitHeader, { marginBottom: 10 }]}>
                        <Text style={styles.sectionTitle}>Who Paid?</Text>
                    </View>

                    <View style={styles.dropdownContainer}>
                        <TouchableOpacity
                            style={styles.dropdownTrigger}
                            onPress={() => setIsPayerDropdownOpen(!isPayerDropdownOpen)}
                        >
                            <View style={styles.dropdownTriggerLeft}>
                                <View style={[styles.dropdownAvatar, paidBy === currentUser?.id && styles.userAvatarMe]}>
                                    <Text style={[styles.dropdownAvatarText, paidBy === currentUser?.id && { color: 'white' }]}>
                                        {paidBy === currentUser?.id ? 'Me' : (allUsers.find(u => u.id === paidBy)?.name?.charAt(0) || '?')}
                                    </Text>
                                </View>
                                <Text style={styles.dropdownTriggerText}>
                                    {paidBy === currentUser?.id ? 'You' : (allUsers.find(u => u.id === paidBy)?.name || 'Select Payer')}
                                </Text>
                            </View>
                            <IconSymbol size={20} name={isPayerDropdownOpen ? "chevron.up" : "chevron.down"} color="#FF8C69" />
                        </TouchableOpacity>

                        {isPayerDropdownOpen && (
                            <View style={styles.dropdownMenu}>
                                {[currentUser, ...users]
                                    .filter(u => u && (
                                        u.id === currentUser?.id ||
                                        selectedUsers.includes(u.id) ||
                                        (searchQuery.length > 0 && (
                                            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            (u.mobile && u.mobile.includes(searchQuery))
                                        ))
                                    ))
                                    .map((user) => {
                                        const isMainUser = user.id === currentUser?.id;
                                        const isSelected = paidBy === user.id;

                                        return (
                                            <TouchableOpacity
                                                key={`payer-opt-${user.id}`}
                                                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                                onPress={() => {
                                                    setPaidBy(user.id);
                                                    setIsPayerDropdownOpen(false);
                                                }}
                                            >
                                                <View style={[styles.miniAvatar, isMainUser && styles.userAvatarMe]}>
                                                    <Text style={[styles.miniAvatarText, isMainUser && { color: 'white' }]}>
                                                        {isMainUser ? 'M' : user.name.charAt(0)}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                                                    {isMainUser ? 'You' : user.name}
                                                </Text>
                                                {isSelected && <IconSymbol size={16} name="checkmark" color="#FF8C69" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>
                        )}
                    </View>

                    <Text style={styles.sectionTitle}>Category</Text>
                    <View style={styles.categoryGrid}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat.name}
                                style={[
                                    styles.categoryItem,
                                    category === cat.name && styles.categoryItemSelected
                                ]}
                                onPress={() => setCategory(cat.name)}
                            >
                                <View style={[
                                    styles.categoryIconWrapper,
                                    category === cat.name && styles.categoryIconWrapperSelected
                                ]}>
                                    <IconSymbol
                                        size={24}
                                        name={cat.icon as any}
                                        color={category === cat.name ? 'white' : '#FF8C69'}
                                    />
                                </View>
                                <Text style={[
                                    styles.categoryText,
                                    category === cat.name && styles.categoryTextSelected
                                ]}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.addButton, (!title || !amount || loading) && styles.addButtonDisabled]}
                        onPress={handleAddExpense}
                        disabled={loading || !title || !amount}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.addButtonText}>Save Expense</Text>
                                <IconSymbol size={20} name="paperplane.fill" color="white" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
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
    headerSpacer: {
        width: 40,
        height: 40,
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
        paddingHorizontal: 25,
        paddingTop: 30,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 25,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 25,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
        fontWeight: '500',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 5,
    },
    inputIcon: {
        marginRight: 10,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: '700',
        marginRight: 10,
        color: '#FF8C69',
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: '#333',
        paddingVertical: 10,
    },
    amountInput: {
        fontSize: 32,
        fontWeight: '700',
        color: '#333',
    },
    splitHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E1E1E',
    },
    splitToggle: {
        flexDirection: 'row',
        backgroundColor: '#EEE',
        borderRadius: 12,
        padding: 4,
    },
    toggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
    },
    toggleTextActive: {
        color: '#FF8C69',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 25,
        marginTop: 15,
    },
    categoryItem: {
        width: '30%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
    },
    categoryItemSelected: {
        backgroundColor: '#FF8C69',
    },
    categoryIconWrapper: {
        width: 45,
        height: 45,
        borderRadius: 15,
        backgroundColor: '#FFF0ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryIconWrapperSelected: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    categoryTextSelected: {
        color: 'white',
    },
    usersList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
        marginBottom: 30,
    },
    userContainer: {
        alignItems: 'center',
        width: 75,
        marginBottom: 10,
    },
    userItem: {
        alignItems: 'center',
        width: '100%',
    },
    userAvatar: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
        backgroundColor: '#E1E1E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
        position: 'relative',
    },
    userAvatarMe: {
        backgroundColor: '#FF8C69',
    },
    userAvatarContact: {
        backgroundColor: '#FFF0ED',
        borderWidth: 2,
        borderColor: '#FF8C69',
    },
    userAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#666',
    },
    checkBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F5F5F5',
    },
    contactBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FF8C69',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F5F5F5',
    },
    userName: {
        fontSize: 11,
        color: '#666',
        textAlign: 'center',
    },
    userPhone: {
        fontSize: 9,
        color: '#999',
        textAlign: 'center',
        marginTop: 2,
    },
    userItemSelected: {
        opacity: 1,
    },
    individualInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 8,
        marginTop: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    miniCurrency: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FF8C69',
        marginRight: 2,
    },
    individualInput: {
        fontSize: 12,
        paddingVertical: 4,
        width: 45,
        color: '#333',
        textAlign: 'center',
    },
    addButton: {
        backgroundColor: '#FF8C69',
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF8C69',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 5,
    },
    addButtonDisabled: {
        backgroundColor: '#FFBFA9',
        elevation: 0,
        shadowOpacity: 0,
    },
    addButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    dropdownContainer: {
        marginBottom: 25,
        position: 'relative',
        zIndex: 1000,
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#EEE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    dropdownTriggerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dropdownTriggerText: {
        fontSize: 16,
        color: '#1E1E1E',
        fontWeight: '600',
    },
    dropdownAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E1E1E1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#666',
    },
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 18,
        marginTop: 8,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
        zIndex: 1001,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    dropdownItemSelected: {
        backgroundColor: '#FFF0ED',
    },
    dropdownItemText: {
        flex: 1,
        fontSize: 15,
        color: '#666',
    },
    dropdownItemTextSelected: {
        color: '#FF8C69',
        fontWeight: '700',
    },
    miniAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E1E1E1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniAvatarText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#666',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 15,
        paddingHorizontal: 15,
        marginBottom: 20,
        height: 50,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    inviteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 15,
        width: '100%',
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#FF8C69',
        borderStyle: 'dashed',
    },
    inviteIconWrapper: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#FFF0ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    inviteTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF8C69',
    },
    inviteSub: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
});
