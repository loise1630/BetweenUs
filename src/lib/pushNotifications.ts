import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { removePushToken, savePushToken } from './relationshipData';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null | undefined;

export function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationsModule !== undefined) return notificationsModule;
  if (Platform.OS === 'web') {
    notificationsModule = null;
    return null;
  }

  try {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return notificationsModule;
  } catch (error) {
    console.warn('Push notifications are unavailable in this app build:', error);
    notificationsModule = null;
    return null;
  }
}

export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (Platform.OS === 'web' || (Platform.OS === 'android' && Constants.expoGoConfig != null)) return 'unsupported';
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function enablePushNotifications(): Promise<string> {
  if (Platform.OS === 'android' && Constants.expoGoConfig != null) {
    throw new Error('Remote push notifications require an Android development or production build. Local reminders can still work in Expo Go.');
  }
  if (!Device.isDevice) {
    throw new Error('Push notifications require a physical device.');
  }
  if (Platform.OS === 'web') {
    throw new Error('Push notifications are available in the iOS and Android apps.');
  }
  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error('Remote push is not configured: add the EAS project ID to app.json (expo.extra.eas.projectId), configure push credentials, and rebuild the app. Local reminders do not need this setup.');
  }
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    throw new Error('Remote push notifications are unavailable in Expo Go on Android. Open this app in an Android development build to enable push alerts.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Relationship updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    throw new Error('Notification permission is disabled. Enable it in your device settings to receive alerts.');
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await savePushToken(token);
  return token;
}

export async function disablePushNotifications(): Promise<void> {
  try {
    const Notifications = await loadNotificationsModule();
    const projectId = getEasProjectId();
    if (!Notifications || !projectId || !Device.isDevice) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await removePushToken(token);
  } catch (error) {
    // The preference is still disabled server-side; token cleanup can be retried later.
    console.warn('Could not remove this device push token:', error);
  }
}

/** Keep one upcoming period and fertile-window reminder scheduled on this device. */
export async function scheduleCycleReminders(nextPeriod: string | null, fertileStart: string | null, isPartnerView = false): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;

  const storage = await import('@react-native-async-storage/async-storage');
  const key = '@betweenus_cycle_reminder_ids_v1';
  if ((await storage.default.getItem('@betweenus_cycle_reminders_enabled_v1')) !== 'on') return;
  const prior: string[] = JSON.parse((await storage.default.getItem(key)) || '[]');
  for (const id of prior) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);

  const scheduled: string[] = [];
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cycle-reminders', {
      name: 'Cycle reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const addReminder = async (date: string | null, daysBefore: number, title: string, body: string) => {
    if (!date) return;
    const triggerDate = new Date(`${date}T09:00:00`);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    if (triggerDate.getTime() <= Date.now()) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, ...(Platform.OS === 'android' ? { channelId: 'cycle-reminders' } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
    scheduled.push(id);
  };

  await addReminder(nextPeriod, 2, 'Period reminder', isPartnerView ? 'Her period is expected in 2 days.' : 'Your period is expected in 2 days.');
  await addReminder(fertileStart, 1, 'Ovulation window', isPartnerView ? 'Her ovulation window starts tomorrow.' : 'Your ovulation window starts tomorrow.');
  await storage.default.setItem(key, JSON.stringify(scheduled));
}
