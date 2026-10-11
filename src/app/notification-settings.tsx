import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNotificationPreferences, NotificationPreferences, saveNotificationPreferences } from '../lib/relationshipData';
import { disablePushNotifications, enablePushNotifications, getEasProjectId, getPushPermissionStatus } from '../lib/pushNotifications';

type PreferenceKey = Exclude<keyof NotificationPreferences, 'push_enabled'>;
const DEFAULTS: NotificationPreferences = { push_enabled: false, message_alerts: true, reply_alerts: true, shared_update_alerts: true, preview_on_lock_screen: false };

export default function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unsupported' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [saved, status] = await Promise.all([getNotificationPreferences(), getPushPermissionStatus()]);
      setPreferences(saved);
      setPermission(status);
      if (saved.push_enabled && status === 'granted') {
        await enablePushNotifications().catch((error) => console.warn('Could not refresh this device token:', error));
      }
    } catch (error: any) {
      Alert.alert('Could not load notification settings', error?.message || 'Please try again.');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function setPushEnabled(enabled: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      if (enabled) {
        await enablePushNotifications();
        const saved = await saveNotificationPreferences({ ...preferences, push_enabled: true });
        setPreferences(saved);
      } else {
        const saved = await saveNotificationPreferences({ ...preferences, push_enabled: false });
        setPreferences(saved);
        await disablePushNotifications();
      }
      setPermission(await getPushPermissionStatus());
    } catch (error: any) {
      Alert.alert('Push notifications unavailable', error?.message || 'Please try again.');
      setPermission(await getPushPermissionStatus().catch(() => 'unknown'));
    } finally { setSaving(false); }
  }

  async function setPreference(key: PreferenceKey, value: boolean) {
    if (saving) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(true);
    try { setPreferences(await saveNotificationPreferences(next)); }
    catch (error: any) { setPreferences(previous); Alert.alert('Could not save setting', error?.message || 'Please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={20} color={COLORS.text} /></Pressable>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {loading ? <ActivityIndicator color={COLORS.pink} style={{ marginTop: 50 }} /> : <>
          <Text style={styles.intro}>Choose which updates reach this device. In-app notifications remain available when push alerts are off.</Text>
          <View style={styles.card}>
            <SettingRow title="Push notifications" description="Receive alerts on this device." value={preferences.push_enabled} onChange={setPushEnabled} disabled={saving} />
            <View style={styles.permissionRow}>
              <Text style={styles.permissionText}>
                {permission === 'unsupported'
                  ? 'Push alerts need an Android development build.'
                  : `Device permission: ${permission}`}
              </Text>
              {permission === 'denied' ? <Pressable onPress={() => void Linking.openSettings()}><Text style={styles.openSettings}>Open settings</Text></Pressable> : null}
            </View>
          </View>
          <Text style={styles.section}>ALERT TYPES</Text>
          <View style={styles.card}>
            <SettingRow title="New messages" description="When your partner sends a message." value={preferences.message_alerts} onChange={(value) => void setPreference('message_alerts', value)} disabled={saving} />
            <SettingRow title="Replies" description="When your partner replies to you." value={preferences.reply_alerts} onChange={(value) => void setPreference('reply_alerts', value)} disabled={saving} />
            <SettingRow title="Shared check-ins" description="When your partner shares a feeling." value={preferences.shared_update_alerts} onChange={(value) => void setPreference('shared_update_alerts', value)} disabled={saving} />
          </View>
          <Text style={styles.section}>PRIVACY</Text>
          <View style={styles.card}>
            <SettingRow title="Show notification details" description="Use general alert text on your lock screen when off." value={preferences.preview_on_lock_screen} onChange={(value) => void setPreference('preview_on_lock_screen', value)} disabled={saving} />
          </View>
          <Text style={styles.footnote}>{!getEasProjectId() ? 'Remote push is not configured: app.json needs expo.extra.eas.projectId. Android Expo Go supports local reminders but not remote push. Remote delivery also needs platform credentials and the Supabase push function and database webhook.' : 'Remote push also needs platform credentials and the Supabase push function and database webhook. Local period and supplement reminders are configured separately.'}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ title, description, value, onChange, disabled }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <View style={styles.row}><View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDescription}>{description}</Text></View><Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: '#D9DDE4', true: COLORS.pink }} /> </View>;
}

const COLORS = { bg: '#FDFDFB', text: '#17181C', muted: '#6B7280', border: '#DCE2EB', pink: '#E5609F', white: '#FFFFFF' };
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 20, paddingBottom: 38 }, header: { flexDirection: 'row', alignItems: 'center', minHeight: 48 }, back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }, title: { marginLeft: 12, fontSize: 20, fontWeight: '600', color: COLORS.text }, intro: { marginTop: 18, marginBottom: 20, fontSize: 13, lineHeight: 20, color: COLORS.muted }, section: { marginTop: 25, marginBottom: 9, fontSize: 10, letterSpacing: 1.4, fontWeight: '700', color: COLORS.muted }, card: { paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F2F5', paddingVertical: 11 }, rowText: { flex: 1, paddingRight: 10 }, rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text }, rowDescription: { marginTop: 4, fontSize: 12, lineHeight: 17, color: COLORS.muted }, permissionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, permissionText: { color: COLORS.muted, fontSize: 11, textTransform: 'capitalize' }, openSettings: { color: COLORS.pink, fontSize: 12, fontWeight: '600' }, footnote: { marginTop: 18, fontSize: 11, lineHeight: 17, color: COLORS.muted } });
