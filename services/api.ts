import { Platform } from 'react-native';
import Constants from 'expo-constants';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')[0];
const fallbackHost = Platform.select({
    android: '10.0.2.2',
    ios: 'localhost',
    default: 'localhost',
});

export const API_URL = configuredApiUrl
    ? configuredApiUrl.replace(/\/$/, '')
    : Platform.OS === 'web'
        ? 'http://localhost:3000'
        : hostFromExpo
            ? `http://${hostFromExpo}:3000`
            : `http://${fallbackHost}:3000`;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let unauthorizedNotified = false;

const notifyUnauthorized = () => {
    if (unauthorizedNotified) return;
    unauthorizedNotified = true;
    unauthorizedHandler?.();
};

const normalizePhone = (phone: string): string => {
    if (!phone) return phone;
    const cleaned = phone.trim().replace(/[^\d+]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('+')) {
        return `+${cleaned.slice(1).replace(/\D/g, '')}`;
    }
    return cleaned.replace(/\D/g, '');
};

const withAuthHeaders = (headers: Record<string, string> = {}) => {
    if (!accessToken) {
        return headers;
    }
    return {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
    };
};

const parseError = async (response: Response, fallbackMessage: string) => {
    try {
        const errorData = await response.json();
        if (typeof errorData?.message === 'string') {
            return errorData.message;
        }
        if (Array.isArray(errorData?.message) && errorData.message.length > 0) {
            return String(errorData.message[0]);
        }
    } catch {
        // ignore parse failure
    }
    return fallbackMessage;
};

export const api = {
    setAccessToken(token: string | null) {
        if (token !== accessToken) {
            unauthorizedNotified = false;
        }
        accessToken = token;
    },

    setUnauthorizedHandler(handler: (() => void) | null) {
        unauthorizedHandler = handler;
    },

    async login(email: string, password: string) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data?.message || 'Invalid email or password' };
            }

            return { success: true, user: data.user, accessToken: data.accessToken };
        } catch {
            return { success: false, message: 'Network error. Is the server running?' };
        }
    },

    async signup(name: string, email: string, password: string, mobile: string) {
        const normalizedMobile = normalizePhone(mobile);
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password, mobile: normalizedMobile }),
            });

            if (!response.ok) {
                const message = await parseError(response, 'Failed to create account');
                return { success: false, message };
            }

            const user = await response.json();
            return { success: true, user };
        } catch {
            return { success: false, message: 'Network error. Is the server running?' };
        }
    },

    async checkMobile(mobile: string) {
        const normalizedMobile = normalizePhone(mobile);
        try {
            const response = await fetch(`${API_URL}/users?mobile=${encodeURIComponent(normalizedMobile)}`);
            const dataRaw = await response.json();
            const data = dataRaw.filter((u: any) => normalizePhone(u.mobile) === normalizedMobile);
            return { success: true, exists: data.length > 0, user: data[0] };
        } catch {
            return { success: false, message: 'Network error' };
        }
    },

    async verifyOtp(mobile: string, otp: string) {
        const normalizedMobile = normalizePhone(mobile);
        try {
            const response = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mobile: normalizedMobile, otp: otp.trim() }),
            });

            if (!response.ok) {
                const message = await parseError(response, 'Invalid OTP');
                return { success: false, message };
            }

            const data = await response.json();
            return { success: true, user: data.user, accessToken: data.accessToken };
        } catch {
            return { success: false, message: 'Network error' };
        }
    },

    async sendOtp(mobile: string) {
        const normalizedMobile = normalizePhone(mobile);
        try {
            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mobile: normalizedMobile }),
            });

            if (!response.ok) {
                const message = await parseError(response, 'Failed to send OTP');
                return { success: false, message };
            }

            const data = await response.json();
            return { success: true, message: data.message };
        } catch {
            return { success: false, message: 'Network error' };
        }
    },

    async addExpense(expense: any, _createdBy?: string) {
        try {
            const response = await fetch(`${API_URL}/expenses`, {
                method: 'POST',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify(expense),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }

            if (!response.ok) {
                const message = await parseError(response, 'Failed to add expense');
                throw new Error(message);
            }

            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async getExpenses(_userId?: string, groupId?: string) {
        try {
            const params = new URLSearchParams();
            if (groupId) params.set('groupId', groupId);
            const query = params.toString();
            const url = `${API_URL}/expenses${query ? `?${query}` : ''}`;
            const response = await fetch(url, {
                headers: withAuthHeaders(),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error('Failed to fetch expenses');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async getUsers() {
        try {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async updateUser(userId: string, updates: { name?: string; email?: string; mobile?: string; avatar?: string }) {
        const normalizedMobile = updates.mobile !== undefined ? normalizePhone(updates.mobile) : undefined;
        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'PATCH',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    ...updates,
                    ...(updates.mobile !== undefined ? { mobile: normalizedMobile } : {}),
                }),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error(await parseError(response, 'Failed to update profile'));
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async inviteUser(userData: { name: string; mobile?: string }) {
        const normalizedMobile = userData.mobile ? normalizePhone(userData.mobile) : undefined;
        try {
            const response = await fetch(`${API_URL}/users/invite`, {
                method: 'POST',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    name: userData.name,
                    mobile: normalizedMobile,
                }),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error('Failed to invite user');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async createGroup(groupData: { name: string; createdBy?: string; members: string[]; invitedUsers?: Array<{ name: string; mobile?: string }> }) {
        try {
            const { createdBy, ...payload } = groupData;
            const response = await fetch(`${API_URL}/groups`, {
                method: 'POST',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify(payload),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }

            if (!response.ok) {
                throw new Error(await parseError(response, 'Failed to create group'));
            }

            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async getGroups(_userId?: string) {
        try {
            const response = await fetch(`${API_URL}/groups`, {
                headers: withAuthHeaders(),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error('Failed to fetch groups');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async updateGroup(
        groupId: string,
        groupData: { name?: string; members?: string[]; invitedUsers?: Array<{ name: string; mobile?: string }> },
        _userId?: string,
    ) {
        try {
            const response = await fetch(`${API_URL}/groups/${groupId}`, {
                method: 'PATCH',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify(groupData),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error(await parseError(response, 'Failed to update group'));
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async deleteGroup(groupId: string, _userId?: string) {
        try {
            const response = await fetch(`${API_URL}/groups/${groupId}`, {
                method: 'DELETE',
                headers: withAuthHeaders(),
            });
            if (response.status === 401) {
                notifyUnauthorized();
                return { success: false, message: 'Session expired. Please sign in again.' };
            }
            if (!response.ok) {
                throw new Error(await parseError(response, 'Failed to delete group'));
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            return { success: false, message: error.message || 'Network error' };
        }
    },
};
