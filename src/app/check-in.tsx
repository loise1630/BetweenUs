import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAccountState, type AccountRole } from '../lib/account';
import { getMyCheckIn, getPartnerCheckIn, savePartnerCheckIn } from '../lib/relationshipData';

const FEELINGS = [
  { label: 'Happy', emoji: '😊' },
  { label: 'Calm', emoji: '😌' },
  { label: 'Sad', emoji: '😔' },
  { label: 'Stressed', emoji: '😣' },
  { label: 'Tired', emoji: '😴' },
  { label: 'Need comfort', emoji: '🫂' },
  { label: 'Want advice', emoji: '💬' },
  { label: 'Need space', emoji: '🌿' },
];

export default function CheckInScreen() {
  const [role, setRole] = useState<AccountRole | null>(null);
  const [feeling, setFeeling] = useState('');
  const [emoji, setEmoji] = useState('');
  const [note, setNote] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [shared, setShared] = useState(false);
  const [viewingPartner, setViewingPartner] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const account = await getAccountState();
      setRole(account.role ?? null);
      const isBoyfriend = account.role === 'boyfriend';
      setViewingPartner(isBoyfriend);
      const current = isBoyfriend
        ? await getPartnerCheckIn('girlfriend')
        : await getMyCheckIn();
      if (current) {
        setFeeling(current.feeling);
        setEmoji(current.emoji);
        setNote(current.note);
        setIntensity(current.intensity);
        setShared(current.share_with_partner);
        setUpdatedAt(current.updated_at);
      } else {
        setFeeling('');
        setEmoji('');
        setNote('');
        setIntensity(3);
        setShared(false);
        setUpdatedAt('');
      }
    } catch (error: any) {
      Alert.alert('Could not load your check-in', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (viewingPartner) return;
    if (!role || !feeling) {
      Alert.alert('Choose how you feel', 'Select a feeling before saving.');
      return;
    }
    try {
      setSaving(true);
      await savePartnerCheckIn(role, feeling, emoji, note, intensity, shared);
      setUpdatedAt(new Date().toISOString());
      Alert.alert('Check-in saved', shared ? 'Your partner can see this update.' : 'This check-in is private.');
    } catch (error: any) {
      Alert.alert('Could not save your check-in', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>{viewingPartner ? "Her check-in" : 'How are you feeling?'}</Text>
        <Text style={styles.subtitle}>{viewingPartner ? 'Only the update she chose to share is shown here.' : 'Your check-in stays private unless you choose to share it.'}</Text>

        {loading ? <ActivityIndicator color={COLORS.pink} style={styles.loader} /> : viewingPartner ? (
          <View style={styles.partnerCard}>
            {feeling ? <>
              <Text style={styles.partnerEmoji}>{emoji}</Text>
              <Text style={styles.partnerFeeling}>{feeling}</Text>
              {note ? <Text style={styles.partnerNote}>{note}</Text> : null}
              {updatedAt ? <Text style={styles.partnerUpdated}>Updated {new Date(updatedAt).toLocaleDateString()}</Text> : null}
            </> : <Text style={styles.emptyPartner}>She hasn’t shared a check-in yet.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.feelings}>
              {FEELINGS.map((item) => {
                const active = feeling === item.label;
                return (
                  <Pressable key={item.label} onPress={() => { setFeeling(item.label); setEmoji(item.emoji); }}
                    style={[styles.feeling, active && styles.feelingActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={styles.feelingEmoji}>{item.emoji}</Text>
                    <Text style={[styles.feelingText, active && styles.feelingTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Intensity</Text>
            <View style={styles.intensities}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setIntensity(value)} style={[styles.intensity, value <= intensity && styles.intensityActive]}>
                  <Text style={[styles.intensityText, value <= intensity && styles.intensityTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Add a note (optional)</Text>
            <TextInput value={note} onChangeText={setNote} maxLength={500} multiline placeholder="Anything you want to remember or share..." placeholderTextColor={COLORS.muted} style={styles.note} />
            <Text style={styles.counter}>{note.length}/500</Text>

            <View style={styles.shareCard}>
              <View style={styles.shareCopy}>
                <Text style={styles.shareTitle}>Share with your partner</Text>
                <Text style={styles.shareDescription}>Only the selected feeling and note will be shared.</Text>
              </View>
              <Switch value={shared} onValueChange={setShared} trackColor={{ false: '#D9DDE4', true: COLORS.pink }} />
            </View>

            <Pressable onPress={save} disabled={saving} style={[styles.save, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save check-in</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const COLORS = { bg: '#FDFDFB', text: '#17181C', muted: '#6B7280', border: '#DCE2EB', pink: '#E5609F', pinkSoft: '#FCE8F1', white: '#FFFFFF' };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 22, paddingBottom: 40 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 24, fontSize: 28, fontWeight: '600', color: COLORS.text }, subtitle: { marginTop: 8, fontSize: 14, lineHeight: 21, color: COLORS.muted }, loader: { marginTop: 40 },
  feelings: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 25 }, feeling: { width: '47%', minHeight: 74, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, flexDirection: 'row', alignItems: 'center', gap: 10 }, feelingActive: { borderColor: COLORS.pink, backgroundColor: COLORS.pinkSoft }, feelingEmoji: { fontSize: 23 }, feelingText: { flexShrink: 1, fontSize: 13, color: COLORS.text }, feelingTextActive: { color: COLORS.pink, fontWeight: '600' },
  label: { marginTop: 23, marginBottom: 10, fontSize: 13, fontWeight: '600', color: COLORS.text }, intensities: { flexDirection: 'row', gap: 10 }, intensity: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white }, intensityActive: { backgroundColor: COLORS.pinkSoft, borderColor: COLORS.pink }, intensityText: { color: COLORS.muted }, intensityTextActive: { color: COLORS.pink, fontWeight: '600' },
  note: { minHeight: 110, padding: 14, textAlignVertical: 'top', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, color: COLORS.text }, counter: { marginTop: 5, alignSelf: 'flex-end', fontSize: 11, color: COLORS.muted },
  shareCard: { marginTop: 22, padding: 15, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' }, shareCopy: { flex: 1, paddingRight: 12 }, shareTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text }, shareDescription: { marginTop: 4, fontSize: 12, lineHeight: 18, color: COLORS.muted },
  save: { height: 50, marginTop: 24, borderRadius: 25, backgroundColor: COLORS.pink, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.6 },
  partnerCard: { marginTop: 28, padding: 24, borderRadius: 20, alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border }, partnerEmoji: { fontSize: 42 }, partnerFeeling: { marginTop: 12, fontSize: 20, fontWeight: '600', color: COLORS.text }, partnerNote: { marginTop: 12, fontSize: 14, lineHeight: 21, color: COLORS.muted, textAlign: 'center' }, partnerUpdated: { marginTop: 16, fontSize: 11, color: COLORS.muted }, emptyPartner: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 21 },
});
