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

console.log('API config:', { API_URL, Platform: Platform.OS });

// Helper function to normalize phone numbers by removing +91 prefix
const normalizePhone = (phone: string): string => {
    if (!phone) return phone;
    return phone.replace(/^\+91/, '').trim();
};

export const api = {
    async login(email: string, password: string) {
        console.log(`[API] Attempting login: ${email}`);
        try {
            const url = `${API_URL}/users?email=${email}&password=${password}`;
            console.log(`[API] Fetching: ${url}`);
            const response = await fetch(url);
            console.log(`[API] Response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[API] Data received:`, data);

            if (data.length > 0) {
                return { success: true, user: data[0] };
            }
            return { success: false, message: 'Invalid email or password' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Is the server running?' };
        }
    },

    async signup(name: string, email: string, password: string, mobile: string) {
        const normalizedMobile = normalizePhone(mobile);
        console.log(`[API] Attempting signup: ${email}, mobile: ${normalizedMobile}`);
        try {
            // Check if user with same email already exists
            const checkUrl = `${API_URL}/users?email=${email}`;

            console.log(`[API] Checking user: ${checkUrl}`);
            const emailResponse = await fetch(checkUrl);
            const emailData = await emailResponse.json();

            // Only block if email already exists with a password (i.e., fully signed up user)
            const existingUser = emailData.find((u: any) => u.password);
            if (existingUser) {
                return { success: false, message: 'Email already exists' };
            }

            // Create new user - backend will merge with invited user if exists
            const createUrl = `${API_URL}/users`;
            console.log(`[API] Creating user: ${createUrl}`);
            const response = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password, mobile: normalizedMobile }),
            });

            const user = await response.json();
            return { success: true, user };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, message: 'Network error. Is the server running?' };
        }
    },

    async checkMobile(mobile: string) {
        const normalizedMobile = normalizePhone(mobile);
        try {
            const url = `${API_URL}/users?mobile=${normalizedMobile}`;
            const response = await fetch(url);
            const dataRaw = await response.json();
            // Manual filter with normalization
            const data = dataRaw.filter((u: any) => normalizePhone(u.mobile) === normalizedMobile);
            return { success: true, exists: data.length > 0, user: data[0] };
        } catch (error) {
            console.error('Check mobile error:', error);
            return { success: false, message: 'Network error' };
        }
    },

    async verifyOtp(mobile: string, otp: string) {
        console.log(`[API] Verifying OTP for ${mobile}`);
        try {
            const url = `${API_URL}/auth/verify-otp`;
            console.log(`[API] URL: ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mobile, otp }),
            });

            const text = await response.text();
            console.log(`[API] Raw response: "${text}"`);

            if (!text) {
                console.warn('[API] Empty response received from server');
                return { success: false, message: 'Server returned empty response' };
            }

            const data = JSON.parse(text);
            console.log(`[API] Parsed data:`, data);

            if (response.ok && data.success) {
                return { success: true, user: data.user };
            } else {
                return { success: false, message: data.message || 'Invalid OTP' };
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            return { success: false, message: 'Network error' };
        }
    },

    async sendOtp(mobile: string) {
        console.log(`[API] Sending OTP to ${mobile}`);
        try {
            const url = `${API_URL}/auth/send-otp`;
            console.log(`[API] URL: ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mobile }),
            });

            const text = await response.text();
            console.log(`[API] Raw response: "${text}"`);

            if (!text) {
                console.warn('[API] Empty response received from server');
                return { success: false, message: 'Server returned empty response' };
            }

            const data = JSON.parse(text);
            console.log(`[API] Parsed data:`, data);

            if (response.ok) {
                return { success: true, message: data.message, otp: data.otp };
            } else {
                return { success: false, message: data.message || 'Failed to send OTP' };
            }
        } catch (error) {
            console.error('Send OTP error:', error);
            return { success: false, message: 'Network error' };
        }
    },

    async addExpense(expense: any, createdBy: string) {
        console.log(`[API] Adding expense:`, expense);
        try {
            const url = `${API_URL}/expenses`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...expense, createdBy }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add expense');
            }

            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Add expense error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async getExpenses(userId?: string, groupId?: string) {
        try {
            const params = new URLSearchParams();
            if (userId) params.set('userId', userId);
            if (groupId) params.set('groupId', groupId);
            const query = params.toString();
            const url = `${API_URL}/expenses${query ? `?${query}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch expenses');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Get expenses error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    },

    async getUsers() {
        try {
            const url = `${API_URL}/users`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Get users error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    },
    async inviteUser(userData: { name: string; mobile?: string }) {
        const normalizedMobile = userData.mobile ? normalizePhone(userData.mobile) : undefined;
        try {
            const url = `${API_URL}/users/invite`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: userData.name,
                    mobile: normalizedMobile,
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to invite user');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Invite user error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    },
    async createGroup(groupData: { name: string; createdBy: string; members: string[]; invitedUsers?: Array<{ name: string; mobile?: string }> }) {
        try {
            const url = `${API_URL}/groups`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(groupData),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to create group';
                try {
                    const errorData = await response.json();
                    if (typeof errorData?.message === 'string') {
                        errorMessage = errorData.message;
                    } else if (Array.isArray(errorData?.message) && errorData.message.length > 0) {
                        errorMessage = String(errorData.message[0]);
                    }
                } catch {
                    // Ignore JSON parse errors and use fallback message.
                }
                throw new Error(errorMessage);
            }

            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Create group error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    },
    async getGroups(userId?: string) {
        try {
            const url = userId ? `${API_URL}/groups?userId=${userId}` : `${API_URL}/groups`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch groups');
            }
            return { success: true, data: await response.json() };
        } catch (error: any) {
            console.error('Get groups error:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    }

};
