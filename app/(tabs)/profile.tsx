import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/ctx';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut, updateSessionUser } = useSession();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    mobile: '',
    avatar: '',
  });

  const user = React.useMemo(() => {
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }, [session]);

  const avatarSource = React.useMemo(() => {
    const selectedAvatar = isEditing ? form.avatar : user?.avatar;
    return {
      uri: selectedAvatar || `https://i.pravatar.cc/150?u=${user?.id ?? 'guest'}`,
    };
  }, [form.avatar, isEditing, user?.avatar, user?.id]);

  React.useEffect(() => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      mobile: user?.mobile ?? '',
      avatar: user?.avatar ?? '',
    });
  }, [user?.name, user?.email, user?.mobile, user?.avatar]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: signOut },
    ]);
  };

  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow media library access to pick a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const nextAvatar = asset.base64
      ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;

    if (nextAvatar.length > 10_000_000) {
      Alert.alert('Image too large', 'Please pick a smaller image.');
      return;
    }

    setForm((prev) => ({ ...prev, avatar: nextAvatar }));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Unable to identify current user');
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const mobile = form.mobile.trim();
    const avatar = form.avatar.trim();

    if (!name) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    const result = await api.updateUser(user.id, { name, email, mobile, avatar });
    setIsSaving(false);

    if (!result.success) {
      Alert.alert('Error', result.message || 'Failed to update profile');
      return;
    }

    const updated = result.data;
    updateSessionUser(updated);
    setForm({
      name: updated?.name ?? name,
      email: updated?.email ?? email,
      mobile: updated?.mobile ?? mobile,
      avatar: updated?.avatar ?? avatar,
    });
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your account</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.profileCard}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle}>Account Details</Text>
            {!isEditing ? (
              <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                <Ionicons name="create-outline" size={14} color="#FF8C69" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isEditing ? (
            <TouchableOpacity onPress={handlePickProfileImage} style={styles.avatarPicker} activeOpacity={0.85}>
              <Image source={avatarSource} style={styles.avatar} fadeDuration={0} />
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color="white" />
              </View>
            </TouchableOpacity>
          ) : (
            <Image source={avatarSource} style={styles.avatar} fadeDuration={0} />
          )}
          <Text style={styles.name}>{user?.name ?? 'User'}</Text>

          {isEditing ? (
            <View style={styles.editForm}>
              <Text style={styles.photoHint}>Tap photo to change</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  placeholder="Enter your name"
                  placeholderTextColor="#B5B5B5"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
                  placeholder="Enter email"
                  placeholderTextColor="#B5B5B5"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile</Text>
                <TextInput
                  style={styles.input}
                  value={form.mobile}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#B5B5B5"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditing(false);
                    setForm({
                      name: user?.name ?? '',
                      email: user?.email ?? '',
                      mobile: user?.mobile ?? '',
                      avatar: user?.avatar ?? '',
                    });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="mail-outline" size={16} color="#FF8C69" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user?.email ?? 'No email'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="call-outline" size={16} color="#FF8C69" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Mobile</Text>
                  <Text style={styles.infoValue}>{user?.mobile ?? 'No mobile number'}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {!isEditing ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : null}
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#FFDCCF',
    borderRadius: 10,
    backgroundColor: '#FFF8F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editButtonText: {
    color: '#FF8C69',
    fontSize: 13,
    fontWeight: '700',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FFF0EA',
    marginBottom: 12,
    alignSelf: 'center',
  },
  avatarPicker: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF8C69',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1E1E',
    textAlign: 'center',
  },
  photoHint: {
    fontSize: 12,
    color: '#8B8B8B',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#FFE7DE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFEDE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9A9A9A',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#252525',
    fontWeight: '600',
    marginTop: 2,
  },
  editForm: {
    width: '100%',
  },
  inputGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 12,
    color: '#8E8E8E',
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#FFE2D6',
    backgroundColor: '#FFF8F4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1E1E1E',
    fontSize: 14,
  },
  formActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFDCCF',
    backgroundColor: '#FFF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#FF8C69',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#FF8C69',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#FF8C69',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
