import {
  router,
  Stack,
  usePathname,
} from 'expo-router';

import { StatusBar } from 'expo-status-bar';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  getAccountState,
} from '../lib/account';
import { getNotificationPreferences, markRelationshipNotificationsRead, savePushToken } from '../lib/relationshipData';
import { getEasProjectId, loadNotificationsModule } from '../lib/pushNotifications';

export default function RootLayout() {
  const pathname = usePathname();

  const [checking, setChecking] =
    useState(true);
  const lastNotificationResponse = useRef<string | null>(null);

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
          '/period',
          '/period-setup',
          '/period-calendar',
          '/period-logs',
          '/period-symptoms',
          '/insights',
          '/want',
          '/unsaid',
          '/little-things',
          '/between-us',
          '/what-i-love',
          '/bucket-list',
          '/check-in',
          '/couple',
          '/explore',
          '/messages',
          '/notifications',
          '/notification-settings',
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

  useEffect(() => {
    let active = true;
    let removeListener: (() => void) | undefined;
    void loadNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;

      const handleResponse = (response: import('expo-notifications').NotificationResponse) => {
        if (lastNotificationResponse.current === response.notification.request.identifier) return;
        lastNotificationResponse.current = response.notification.request.identifier;
        const data = response.notification.request.content.data as { route?: unknown; notificationId?: unknown };
        const route = data.route === '/check-in' ? '/check-in' : '/messages';
        if (active) router.push(route);
        if (typeof data.notificationId === 'string') {
          void markRelationshipNotificationsRead([data.notificationId]).catch((error) => {
            console.warn('Could not mark push notification read:', error);
          });
        }
      };

      const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      removeListener = () => subscription.remove();
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (active && response) handleResponse(response);
      }).catch((error) => console.warn('Could not read last notification response:', error));
    });

    return () => {
      active = false;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    const projectId = getEasProjectId();
    if (!projectId) return;
    let active = true;
    let removeListener: (() => void) | undefined;
    void loadNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;
      const subscription = Notifications.addPushTokenListener(() => {
        void (async () => {
          try {
            const preferences = await getNotificationPreferences();
            if (!preferences.push_enabled) return;
            const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            await savePushToken(token);
          } catch (error) {
            console.warn('Could not refresh the Expo push token:', error);
          }
        })();
      });
      removeListener = () => subscription.remove();
    });
    return () => {
      active = false;
      removeListener?.();
    };
  }, []);

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
