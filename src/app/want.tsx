import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getAccountState, type AccountRole } from '../lib/account';
import { addPartnerWant, getMyWants, getPartnerWants, PartnerWant, toggleWantFulfilled } from '../lib/relationshipData';
import { Screen } from '../lib/ui';

const CATEGORIES: PartnerWant['category'][] = ['affection', 'date', 'gift', 'food', 'care'];
const WANT_SUGGESTIONS = [
  'Plan a cozy date',
  'Bring me my favorite snack',
  'Give me a long hug',
  'Help me unwind tonight',
];

export default function WantScreen() {
  const [role, setRole] = useState<AccountRole | null>(null);
  const [myWants, setMyWants] = useState<PartnerWant[]>([]);
  const [partnerWants, setPartnerWants] = useState<PartnerWant[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<PartnerWant['category']>('affection');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const account = await getAccountState();
      setRole(account.role ?? null);
      const [own, partner] = await Promise.all([getMyWants(), getPartnerWants()]);
      setMyWants(own);
      setPartnerWants(partner);
    } catch (error: any) {
      Alert.alert('Could not load wants', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function addWant() {
    if (!role) return;
    try {
      setSaving(true);
      await addPartnerWant(role, title, category, note);
      setTitle('');
      setNote('');
      await load();
    } catch (error: any) {
      Alert.alert('Could not save your want', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string) {
    try {
      await toggleWantFulfilled(id);
      await load();
    } catch (error: any) {
      Alert.alert('Could not update this want', error?.message || 'Please try again.');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Wants</Text>
        <Text style={styles.subtitle}>Share little things that would make you feel loved.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add a want</Text>
          <Text style={styles.suggestionLabel}>Need an idea? Pick one, then edit it or write your own.</Text>
          <View style={styles.suggestions}>
            {WANT_SUGGESTIONS.map((suggestion) => (
              <Pressable key={suggestion} onPress={() => setTitle(suggestion)} style={styles.suggestionChip} accessibilityRole="button">
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="What would you love?" placeholderTextColor={COLORS.muted} style={styles.input} />
          <Text style={styles.label}>Category</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => {
              const active = category === item;
              return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, active && styles.categoryActive]} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text></Pressable>;
            })}
          </View>
          <TextInput value={note} onChangeText={setNote} maxLength={500} multiline placeholder="Add a note (optional)" placeholderTextColor={COLORS.muted} style={[styles.input, styles.note]} />
          <Pressable onPress={addWant} disabled={saving || !title.trim()} style={[styles.save, (saving || !title.trim()) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Share with my partner</Text>}
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={COLORS.pink} style={styles.loader} /> : <>
          <WantList title="Your wants" items={myWants} empty="Nothing added yet." onToggle={toggle} />
          <WantList title="Your partner’s wants" items={partnerWants} empty="Your partner hasn’t shared a want yet." onToggle={toggle} />
        </>}
      </ScrollView>
    </Screen>
  );
}

function WantList({ title, items, empty, onToggle }: { title: string; items: PartnerWant[]; empty: string; onToggle: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? items.map((item) => (
        <Pressable key={item.id} onPress={() => onToggle(item.id)} style={styles.wantRow} accessibilityRole="button" accessibilityLabel={`${item.fulfilled ? 'Mark incomplete' : 'Mark complete'}: ${item.title}`}>
          <Feather name={item.fulfilled ? 'check-circle' : 'circle'} size={19} color={item.fulfilled ? '#6BAA83' : COLORS.pink} />
          <View style={styles.wantCopy}>
            <Text style={[styles.wantTitle, item.fulfilled && styles.fulfilled]}>{item.title}</Text>
            <Text style={styles.wantMeta}>{item.category}{item.note ? ` · ${item.note}` : ''}</Text>
          </View>
        </Pressable>
      )) : <Text style={styles.empty}>{empty}</Text>}
    </View>
  );
}

const COLORS = { bg: '#FFFDFD', text: '#282638', muted: '#84808D', border: '#F2E8EB', pink: '#F4768F', pinkSoft: '#FEF0F3', white: '#FFFFFF' };
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 6, fontSize: 27, fontWeight: '700', color: COLORS.text },
  subtitle: { marginTop: -8, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  suggestionLabel: { marginTop: -6, marginBottom: 9, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  suggestionChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: COLORS.pinkSoft, borderWidth: 1, borderColor: '#F8D8E1' },
  suggestionText: { color: COLORS.pink, fontSize: 10, fontWeight: '600' },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, color: COLORS.text, backgroundColor: '#FFFEFE' },
  label: { marginTop: 14, marginBottom: 8, fontSize: 11, fontWeight: '600', color: COLORS.muted },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  category: { borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F7F5F6' },
  categoryActive: { backgroundColor: COLORS.pinkSoft },
  categoryText: { color: COLORS.muted, fontSize: 10, textTransform: 'capitalize' },
  categoryTextActive: { color: COLORS.pink, fontWeight: '700' },
  note: { marginTop: 12, minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  save: { minHeight: 46, marginTop: 13, borderRadius: 23, backgroundColor: COLORS.pink, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  loader: { marginTop: 30 },
  wantRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: '#F5EFF1' },
  wantCopy: { flex: 1, paddingVertical: 9 },
  wantTitle: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  fulfilled: { color: COLORS.muted, textDecorationLine: 'line-through' },
  wantMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  empty: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
});
