import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/ctx';

export default function Login() {
    const [loginMode, setLoginMode] = React.useState<'email' | 'mobile'>('email');
    const [mobile, setMobile] = React.useState('');
    const [otp, setOtp] = React.useState('');
    const [showOtpInput, setShowOtpInput] = React.useState(false);
    const [timer, setTimer] = React.useState(0);

    const { signIn, signInWithOtp, sendOtp } = useSession();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');

    const validateEmail = (email: string) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        const result = await signIn(email, password);
        if (result.success) {
            router.replace('/');
        } else {
            Alert.alert('Error', result.message || 'Login failed');
        }
    };

    React.useEffect(() => {
        let interval: any;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendOtp = async () => {
        if (mobile.length < 10) {
            Alert.alert('Error', 'Please enter a valid mobile number');
            return;
        }
        const result = await sendOtp(mobile);
        if (result.success) {
            setShowOtpInput(true);
            setTimer(60);
            Alert.alert('Success', 'OTP sent to your mobile number');
        } else {
            Alert.alert('Error', result.message || 'Failed to send OTP');
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            Alert.alert('Error', 'Please enter OTP');
            return;
        }
        const result = await signInWithOtp(mobile, otp);
        if (result.success) {
            router.replace('/');
        } else {
            Alert.alert('Error', result.message || 'Login failed');
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

                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, loginMode === 'email' && styles.activeTab]}
                                onPress={() => setLoginMode('email')}
                            >
                                <Text style={[styles.tabText, loginMode === 'email' && styles.activeTabText]}>Email</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, loginMode === 'mobile' && styles.activeTab]}
                                onPress={() => setLoginMode('mobile')}
                            >
                                <Text style={[styles.tabText, loginMode === 'mobile' && styles.activeTabText]}>Mobile</Text>
                            </TouchableOpacity>
                        </View>

                        {loginMode === 'email' ? (
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

                                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                                    <Text style={styles.buttonText}>Login</Text>
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
                                        editable={!showOtpInput}
                                    />
                                </View>

                                {showOtpInput && (
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.label}>OTP</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter OTP"
                                            placeholderTextColor="#999"
                                            value={otp}
                                            onChangeText={setOtp}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                )}

                                {!showOtpInput ? (
                                    <TouchableOpacity style={styles.button} onPress={handleSendOtp}>
                                        <Text style={styles.buttonText}>Send OTP</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.button} onPress={handleVerifyOtp}>
                                        <Text style={styles.buttonText}>Verify & Login</Text>
                                    </TouchableOpacity>
                                )}

                                {showOtpInput && (
                                    <TouchableOpacity
                                        style={[styles.resendButton, timer > 0 && styles.disabledResendButton]}
                                        onPress={handleSendOtp}
                                        disabled={timer > 0}
                                    >
                                        <Text style={[styles.resendButtonText, timer > 0 && styles.disabledResendButtonText]}>
                                            {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
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
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        color: '#666',
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: '#FF8C69',
        fontWeight: 'bold',
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
    resendButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 8,
    },
    disabledResendButton: {
        opacity: 0.6,
    },
    resendButtonText: {
        color: '#FF8C69',
        fontSize: 14,
        fontWeight: '600',
    },
    disabledResendButtonText: {
        color: '#999',
    },
});
