import React from 'react';
import { useStorageState } from './hooks/useStorageState';
import { api } from './services/api';

const AuthContext = React.createContext<{
    signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    signUp: (name: string, email: string, password: string, mobile: string) => Promise<{ success: boolean; message?: string }>;
    signInWithOtp: (mobile: string, otp: string) => Promise<{ success: boolean; message?: string }>;
    sendOtp: (mobile: string) => Promise<{ success: boolean; message?: string; otp?: string }>;
    signOut: () => void;
    session?: string | null;
    isLoading: boolean;
    hasNotifications: boolean;
    setHasNotifications: (val: boolean) => void;
    notifications: any[];
    addNotification: (notification: any) => void;
    clearNotifications: () => void;
}>({
    signIn: async () => ({ success: false }),
    signUp: async () => ({ success: false }),
    signInWithOtp: async () => ({ success: false }),
    sendOtp: async () => ({ success: false }),
    signOut: () => null,
    session: null,
    isLoading: false,
    hasNotifications: false,
    setHasNotifications: () => { },
    notifications: [],
    addNotification: () => { },
    clearNotifications: () => { },
});

// This hook can be used to access the user info.
export function useSession() {
    const value = React.useContext(AuthContext);
    if (process.env.NODE_ENV !== 'production') {
        if (!value) {
            throw new Error('useSession must be wrapped in a <SessionProvider />');
        }
    }

    return value;
}

export function SessionProvider(props: React.PropsWithChildren) {
    const [[isLoading, session], setSession] = useStorageState('session');
    const [hasNotifications, setHasNotifications] = React.useState(false);
    const [notifications, setNotifications] = React.useState<any[]>([]);

    const addNotification = React.useCallback((notification: any) => {
        setNotifications(prev => [notification, ...prev].slice(0, 10)); // Keep last 10
        setHasNotifications(true);
    }, []);

    const clearNotifications = React.useCallback(() => {
        setHasNotifications(false);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                signIn: async (email, password) => {
                    const result = await api.login(email, password);
                    if (result.success) {
                        setSession(JSON.stringify(result.user));
                        return { success: true };
                    }
                    return { success: false, message: result.message };
                },
                signUp: async (name, email, password, mobile) => {
                    const result = await api.signup(name, email, password, mobile);
                    if (result.success) {
                        return { success: true };
                    }
                    return { success: false, message: result.message };
                },
                signInWithOtp: async (mobile, otp) => {
                    const result = await api.verifyOtp(mobile, otp);
                    if (result.success) {
                        setSession(JSON.stringify(result.user));
                        return { success: true };
                    }
                    return { success: false, message: result.message };
                },
                sendOtp: async (mobile) => {
                    const result = await api.sendOtp(mobile);
                    if (result.success) {
                        return { success: true, message: result.message, otp: result.otp };
                    }
                    return { success: false, message: result.message };
                },
                signOut: () => {
                    setSession(null);
                },
                session,
                isLoading,
                hasNotifications,
                setHasNotifications,
                notifications,
                addNotification,
                clearNotifications,
            }}>
            {props.children}
        </AuthContext.Provider>
    );
}
