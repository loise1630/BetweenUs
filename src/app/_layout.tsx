import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getAccountState } from '../lib/account';

export default function RootLayout() {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAccount() {
      try {
        const state = await getAccountState();

        if (!mounted) {
          return;
        }

        const allowedAuthenticatedRoutes = ['/home', '/settings'];

        if (state.status === 'waiting' || state.status === 'paired') {
          if (!allowedAuthenticatedRoutes.includes(pathname)) {
            router.replace('/home');
          }

          return;
        }
      } catch (error) {
        console.log('ROOT ACCOUNT CHECK:', error);
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkAccount();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#E8D6DF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#03346E" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: '#E8D6DF',
          },
        }}
      />
    </>
  );
}