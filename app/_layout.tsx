import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Text } from 'react-native';
import React from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/ctx';
import { useNotifications } from '@/hooks/useNotifications';

function InitialLayout() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  useNotifications();

  React.useEffect(() => {
    if (isLoading) return;
    if (!session && segments[0] !== '(auth)') {
      // Redirect to the sign-in page.
      router.replace('/login');
    } else if (session && segments[0] === '(auth)') {
      // Redirect away from the sign-in page.
      router.replace('/');
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return <Slot />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <InitialLayout />
        <StatusBar style="auto" />
      </ThemeProvider>
    </SessionProvider>
  );
}
