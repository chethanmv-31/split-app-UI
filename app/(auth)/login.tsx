import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/ctx';

export default function Login() {
    const { signIn, signInWithOtp, sendOtp } = useSession();
    const [mode, setMode] = React.useState<'email' | 'mobile'>('email');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [mobile, setMobile] = React.useState('');
    const [otp, setOtp] = React.useState('');
    const [otpSentTo, setOtpSentTo] = React.useState<string | null>(null);
    const [otpCooldown, setOtpCooldown] = React.useState(0);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSendingOtp, setIsSendingOtp] = React.useState(false);

    const validateEmail = (email: string) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const normalizePhone = (input: string): string => {
        const cleaned = input.trim().replace(/[^\d+]/g, '');
        if (!cleaned) return '';
        if (cleaned.startsWith('+')) {
            return `+${cleaned.slice(1).replace(/\D/g, '')}`;
        }
        return cleaned.replace(/\D/g, '');
    };

    const isValidPhone = (input: string): boolean => /^\+?\d{10,15}$/.test(input);

    React.useEffect(() => {
        if (otpCooldown <= 0) return;
        const interval = setInterval(() => {
            setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [otpCooldown]);

    React.useEffect(() => {
        if (mode === 'email') {
            setMobile('');
            setOtp('');
            setOtpSentTo(null);
            setOtpCooldown(0);
        }
    }, [mode]);

    React.useEffect(() => {
        const normalized = normalizePhone(mobile);
        if (!otpSentTo) return;
        if (normalized && normalized !== otpSentTo) {
            setOtp('');
            setOtpSentTo(null);
            setOtpCooldown(0);
        }
    }, [mobile, otpSentTo]);

    const handleLogin = async () => {
        if (isSubmitting) return;

        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await signIn(email, password);
            if (result.success) {
                router.replace('/');
            } else {
                Alert.alert('Error', result.message || 'Login failed');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendOtp = async () => {
        if (isSendingOtp || otpCooldown > 0) return;

        const normalizedMobile = normalizePhone(mobile);
        if (!isValidPhone(normalizedMobile)) {
            Alert.alert('Error', 'Please enter a valid mobile number');
            return;
        }

        setIsSendingOtp(true);
        try {
            const result = await sendOtp(normalizedMobile);
            if (!result.success) {
                Alert.alert('Error', result.message || 'Failed to send OTP');
                return;
            }

            setOtp('');
            setOtpSentTo(normalizedMobile);
            setOtpCooldown(60);
            Alert.alert('OTP Sent', 'Check your mobile for the 4-digit code.');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (isSubmitting) return;

        const normalizedMobile = normalizePhone(mobile);
        if (!otpSentTo || normalizedMobile !== otpSentTo) {
            Alert.alert('Error', 'Please request OTP for this number first.');
            return;
        }

        if (!/^\d{4}$/.test(otp.trim())) {
            Alert.alert('Error', 'OTP must be a 4-digit code');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await signInWithOtp(normalizedMobile, otp.trim());
            if (result.success) {
                router.replace('/');
            } else {
                Alert.alert('Error', result.message || 'OTP login failed');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoIcon}>
                            <View style={[styles.circle, styles.circleLeft]} />
                            <View style={[styles.circle, styles.circleRight]} />
                        </View>
                        <Text style={styles.appName}>Splitty</Text>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Welcome Back!</Text>
                        <Text style={styles.subtitle}>Sign in to continue</Text>

                        <View style={styles.modeSwitch}>
                            <TouchableOpacity
                                style={[styles.modeButton, mode === 'email' && styles.modeButtonActive]}
                                onPress={() => setMode('email')}
                                disabled={isSubmitting || isSendingOtp}
                            >
                                <Text style={[styles.modeText, mode === 'email' && styles.modeTextActive]}>Email</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeButton, mode === 'mobile' && styles.modeButtonActive]}
                                onPress={() => setMode('mobile')}
                                disabled={isSubmitting || isSendingOtp}
                            >
                                <Text style={[styles.modeText, mode === 'mobile' && styles.modeTextActive]}>Mobile OTP</Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'email' ? (
                            <>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your email"
                                        placeholderTextColor="#999"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your password"
                                        placeholderTextColor="#999"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, isSubmitting && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.buttonText}>{isSubmitting ? 'Signing in...' : 'Login'}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Mobile Number</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your mobile number"
                                        placeholderTextColor="#999"
                                        value={mobile}
                                        onChangeText={setMobile}
                                        keyboardType="phone-pad"
                                        autoCapitalize="none"
                                    />
                                </View>

                                {!otpSentTo ? (
                                    <TouchableOpacity
                                        style={[styles.button, isSendingOtp && styles.buttonDisabled]}
                                        onPress={handleSendOtp}
                                        disabled={isSendingOtp}
                                    >
                                        <Text style={styles.buttonText}>
                                            {isSendingOtp ? 'Sending...' : 'Send OTP'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}

                                {otpSentTo ? (
                                    <>
                                        <View style={[styles.inputContainer, { marginTop: 6, marginBottom: 12 }]}>
                                            <Text style={styles.label}>OTP</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Enter 4-digit OTP"
                                                placeholderTextColor="#999"
                                                value={otp}
                                                onChangeText={setOtp}
                                                keyboardType="number-pad"
                                                maxLength={4}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleSendOtp}
                                            disabled={isSendingOtp || otpCooldown > 0}
                                            style={styles.resendRow}
                                        >
                                            <Text
                                                style={[
                                                    styles.resendText,
                                                    (isSendingOtp || otpCooldown > 0) && styles.resendTextDisabled,
                                                ]}
                                            >
                                                {isSendingOtp ? 'Sending OTP...' : otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : 'Resend OTP'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.button, isSubmitting && styles.buttonDisabled]}
                                            onPress={handleVerifyOtp}
                                            disabled={isSubmitting}
                                        >
                                            <Text style={styles.buttonText}>{isSubmitting ? 'Verifying...' : 'Verify & Login'}</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : null}
                            </>
                        )}


                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/signup')}>
                                <Text style={styles.link}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 60,
        justifyContent: 'center',
    },
    logoIcon: {
        width: 32,
        height: 32,
        position: 'relative',
    },
    circle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        position: 'absolute',
        backgroundColor: 'white',
    },
    circleLeft: {
        top: 0,
        left: 0,
    },
    circleRight: {
        bottom: 0,
        right: 0,
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        color: 'white',
    },
    formContainer: {
        backgroundColor: 'white',
        borderRadius: 32,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E1E1E',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    modeSwitch: {
        flexDirection: 'row',
        backgroundColor: '#F3F3F3',
        borderRadius: 14,
        padding: 4,
        marginBottom: 18,
    },
    modeButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    modeButtonActive: {
        backgroundColor: '#FFFFFF',
    },
    modeText: {
        color: '#666',
        fontSize: 13,
        fontWeight: '700',
    },
    modeTextActive: {
        color: '#FF8C69',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E1E1E',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1E1E1E',
    },
    button: {
        backgroundColor: '#FF8C69',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#FF8C69',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    resendRow: {
        marginTop: -4,
        marginBottom: 8,
        alignItems: 'flex-end',
    },
    resendText: {
        color: '#FF8C69',
        fontSize: 13,
        fontWeight: '700',
    },
    resendTextDisabled: {
        color: '#B7B7B7',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        color: '#666',
        fontSize: 14,
    },
    link: {
        color: '#FF8C69',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
