import {
  router,
  Stack,
  usePathname,
} from 'expo-router';

import { StatusBar } from 'expo-status-bar';

import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  getAccountState,
} from '../lib/account';

export default function RootLayout() {
  const pathname = usePathname();

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAccount() {
      try {
        const state =
          await getAccountState();

        if (!mounted) {
          return;
        }

        const authenticatedRoutes = [
          '/home',
          '/settings',
          '/boyfriend',
          '/girlfriend',
          '/period',
          '/period-setup',
          '/couple',
          '/explore',
        ];

        if (
          state.status === 'waiting' ||
          state.status === 'paired'
        ) {
          const isAllowed =
            authenticatedRoutes.some(
              (route) =>
                pathname === route ||
                pathname.startsWith(
                  `${route}/`
                )
            );

          if (!isAllowed) {
            router.replace('/home');
          }

          return;
        }
      } catch (error) {
        console.log(
          'ROOT ACCOUNT CHECK:',
          error
        );
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
          backgroundColor: '#FDFDFB',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          color="#E5609F"
        />
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
            backgroundColor: '#FDFDFB',
          },
        }}
      />
    </>
  );
}
