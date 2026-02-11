import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSession } from '@/ctx';
import { api } from '@/services/api';
import { useContacts } from '@/hooks/useContacts';

type UserLike = {
    id: string;
    name: string;
    mobile?: string;
};

type Group = {
    id: string;
    name: string;
    members: string[];
};

type EditGroupFormProps = {
    group: Group;
    onCancel: () => void;
    onSuccess: () => void;
};

export function EditGroupForm({ group, onCancel, onSuccess }: EditGroupFormProps) {
    const { session } = useSession();
    const currentUser = session ? JSON.parse(session) : null;
    const { contacts } = useContacts();

    const [groupName, setGroupName] = useState(group.name);
    const [allUsers, setAllUsers] = useState<UserLike[]>([]);
    const [users, setUsers] = useState<UserLike[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>(group.members);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [invitedUsersMap, setInvitedUsersMap] = useState<{ [key: string]: { name: string; mobile?: string } }>({});

    useEffect(() => {
        setGroupName(group.name);
        setSelectedUsers(group.members);
        setSearchQuery('');
        setInvitedUsersMap({});
    }, [group]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const result = await api.getUsers();
        if (result.success) {
            setAllUsers(result.data);
            setUsers(result.data);
        }
    };

    const normalizePhone = (phone?: string): string => {
        if (!phone) return '';
        return phone.replace(/^\+91/, '').replace(/\s/g, '').trim();
    };

    const toggleUserSelection = (userId: string) => {
        if (userId === currentUser?.id) return;
        setSelectedUsers(prev => (
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        ));
    };

    const handleInviteUser = async (contactName?: string, contactPhone?: string) => {
        const name = contactName || searchQuery.trim();
        const phone = contactPhone;
        if (!name) return;

        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            const existingUser = allUsers.find(u => normalizePhone(u.mobile) === normalizedPhone);
            if (existingUser) {
                if (!selectedUsers.includes(existingUser.id)) {
                    setSelectedUsers(prev => [...prev, existingUser.id]);
                }
                Alert.alert('Already Added', `${existingUser.name} is now included in this group.`);
                setInviting(false);
                return;
            }
        }

        setInviting(true);
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
            setInvitedUsersMap(prev => ({
                ...prev,
                [newUser.id]: {
                    name: newUser.name,
                    mobile: newUser.mobile
                }
            }));
            setSearchQuery('');
            Alert.alert('Success', `${newUser.name} added to group members.`);
        } else {
            Alert.alert('Error', result.message || 'Failed to add member');
        }
        setInviting(false);
    };

    const searchLower = searchQuery.toLowerCase();
    const visibleItems = useMemo(() => {
        const matchedContacts = searchQuery.length > 0
            ? contacts.filter(contact =>
                !allUsers.some(u => normalizePhone(u.mobile) === normalizePhone(contact.phoneNumber)) &&
                (contact.name.toLowerCase().includes(searchLower) ||
                    (contact.phoneNumber && contact.phoneNumber.includes(searchQuery)))
            )
            : [];

        return [currentUser, ...users, ...matchedContacts].filter(Boolean);
    }, [allUsers, contacts, currentUser, users, searchLower, searchQuery]);

    const canShowInvite = searchQuery.length > 2 &&
        !users.some(u => u.name.toLowerCase().includes(searchLower) || (u.mobile && u.mobile.includes(searchQuery))) &&
        !contacts.some(c => c.name.toLowerCase().includes(searchLower) || (c.phoneNumber && c.phoneNumber.includes(searchQuery)));

    const handleSave = async () => {
        const finalGroupName = groupName.trim();
        if (!finalGroupName) {
            Alert.alert('Error', 'Group name should not be empty');
            return;
        }
        if (selectedUsers.length < 2) {
            Alert.alert('Error', 'Select at least one member besides you');
            return;
        }
        if (!currentUser?.id) {
            Alert.alert('Error', 'Unable to identify current user');
            return;
        }

        setSaving(true);
        const payload: { name: string; members: string[]; invitedUsers?: Array<{ name: string; mobile?: string }> } = {
            name: finalGroupName,
            members: Array.from(new Set(selectedUsers)),
        };

        if (Object.keys(invitedUsersMap).length > 0) {
            payload.invitedUsers = Object.values(invitedUsersMap);
        }

        const result = await api.updateGroup(group.id, payload, currentUser.id);
        setSaving(false);

        if (result.success) {
            Alert.alert('Success', 'Group updated successfully', [
                { text: 'OK', onPress: onSuccess }
            ]);
        } else {
            Alert.alert('Error', result.message || 'Failed to update group');
        }
    };

    return (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.card}>
                <Text style={styles.label}>Group Name</Text>
                <View style={styles.inputWrapper}>
                    <IconSymbol size={18} name="person.3.fill" color="#999" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.input}
                        placeholder="Weekend Trip"
                        value={groupName}
                        onChangeText={setGroupName}
                        placeholderTextColor="#999"
                    />
                </View>
            </View>

            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.searchContainer}>
                <IconSymbol size={18} name="magnifyingglass" color="#999" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or mobile..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                />
            </View>

            <View style={styles.usersList}>
                {visibleItems
                    .filter((u: any) => {
                        if (!searchQuery) return true;
                        return u.name?.toLowerCase().includes(searchLower) ||
                            (u.mobile && u.mobile.includes(searchQuery)) ||
                            (u.phoneNumber && u.phoneNumber.includes(searchQuery));
                    })
                    .map((user: any) => {
                        const isMainUser = user.id === currentUser?.id;
                        const isSelected = selectedUsers.includes(user.id);
                        const isContact = Boolean(user.isContact);
                        return (
                            <TouchableOpacity
                                key={user.id || user.phoneNumber}
                                style={[styles.userItem, isSelected && styles.userItemSelected]}
                                onPress={() => {
                                    if (isContact) {
                                        handleInviteUser(user.name, user.phoneNumber);
                                    } else {
                                        toggleUserSelection(user.id);
                                    }
                                }}
                            >
                                <View style={[styles.userAvatar, isMainUser && styles.userAvatarMe, isContact && styles.userAvatarContact]}>
                                    <Text style={[styles.userAvatarText, isMainUser && { color: 'white' }]}>
                                        {isMainUser ? 'Me' : user.name?.charAt(0)}
                                    </Text>
                                </View>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {isMainUser ? 'You' : user.name}
                                </Text>
                                {isContact && user.phoneNumber ? (
                                    <Text style={styles.userPhone} numberOfLines={1}>{user.phoneNumber}</Text>
                                ) : null}
                                {isSelected && !isMainUser ? (
                                    <View style={styles.checkBadge}>
                                        <IconSymbol size={12} name="checkmark" color="white" />
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}

                {canShowInvite && (
                    <TouchableOpacity style={styles.inviteCard} onPress={() => handleInviteUser()} disabled={inviting}>
                        <View style={styles.inviteIconWrapper}>
                            {inviting ? <ActivityIndicator size="small" color="#FF8C69" /> : <IconSymbol size={20} name="person.badge.plus" color="#FF8C69" />}
                        </View>
                        <View>
                            <Text style={styles.inviteTitle}>Invite "{searchQuery}"</Text>
                            <Text style={styles.inviteSub}>Tap to add as a new member.</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
        fontWeight: '500',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    input: {
        flex: 1,
        fontSize: 17,
        color: '#333',
        paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E1E1E',
        marginBottom: 12,
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
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    usersList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 25,
    },
    userItem: {
        alignItems: 'center',
        width: 76,
        opacity: 0.8,
    },
    userItemSelected: {
        opacity: 1,
    },
    checkBadge: {
        position: 'absolute',
        top: -3,
        right: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E1E1E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
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
    inviteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: '#FF8C69',
        borderStyle: 'dashed',
    },
    inviteIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF0ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    inviteTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF8C69',
    },
    inviteSub: {
        fontSize: 11,
        color: '#999',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#FF8C69',
    },
    cancelButtonText: {
        color: '#FF8C69',
        fontSize: 16,
        fontWeight: '700',
    },
    saveButton: {
        flex: 2,
        backgroundColor: '#FF8C69',
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#FFBFA9',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 17,
        fontWeight: '700',
    },
});
