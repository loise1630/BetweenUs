import Feather from '@expo/vector-icons/Feather';
import { router, usePathname, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getAccountState, type AccountRole } from '../lib/account';
import { addRelationshipEntry, deleteRelationshipEntry, getRelationshipEntries, RelationshipEntry, RelationshipEntryType, updateRelationshipEntry } from '../lib/relationshipData';
import { Screen } from '../lib/ui';

const CONFIG: Record<string, {
  type: RelationshipEntryType;
  title: string;
  subtitle: string;
  prompt: string;
  ideas: string[];
  color: string;
  tint: string;
}> = {
  unsaid: {
    type: 'unsaid', title: 'Unsaid', subtitle: 'A gentle place to put something you’ve been meaning to say.',
    prompt: 'What would you like your partner to understand?',
    ideas: ['I have been wanting to tell you…', 'Something I find hard to say is…', 'I feel closest to you when…'],
    color: '#E5609F', tint: '#FCE8F1',
  },
  'little-things': {
    type: 'little_things', title: 'Little Things', subtitle: 'Save the small gestures that make your days better.',
    prompt: 'What little thing would make them smile?',
    ideas: ['Make their favorite drink', 'Leave a sweet note', 'Ask how their day really went'],
    color: '#D49A2A', tint: '#FFF6E3',
  },
  'what-i-love': {
    type: 'love_hate', title: 'What I love / hate about you', subtitle: 'Share appreciation or something you hope to improve together.',
    prompt: 'Write it in your own words. Keep it kind and specific.',
    ideas: ['I love how you…', 'I appreciate when you…', 'I’d like us to work on…'],
    color: '#E88970', tint: '#FFF0EB',
  },
  'bucket-list': {
    type: 'bucket_list', title: 'Our Bucket Lists', subtitle: 'Collect experiences you want to share together.',
    prompt: 'What would you like to do together?',
    ideas: ['Watch the sunrise somewhere new', 'Try a food neither of us has had', 'Take a weekend trip'],
    color: '#65A67E', tint: '#EAF6EE',
  },
};

export default function Feature() {
  const pathname = usePathname();
  const slug = pathname.split('/').filter(Boolean).at(-1) || '';
  const config = CONFIG[slug] || CONFIG.unsaid;
  const [role, setRole] = useState<AccountRole | null>(null);
  const [items, setItems] = useState<RelationshipEntry[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [account, entries] = await Promise.all([
        getAccountState(),
        getRelationshipEntries(config.type),
      ]);
      setRole(account.role ?? null);
      setItems(entries);
    } catch (error: any) {
      Alert.alert('Could not load this space', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [config.type]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const suggestions = useMemo(() => config.ideas, [config]);

  async function save() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Add your own words', 'Choose an idea if helpful, then enter a title and your message before saving.');
      return;
    }
    try {
      setSaving(true);
      if (editingId) await updateRelationshipEntry(editingId, title, body);
      else await addRelationshipEntry(config.type, title, body);
      setTitle('');
      setBody('');
      setEditingId(null);
      await load();
    } catch (error: any) {
      Alert.alert('Could not save this entry', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: RelationshipEntry) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
  }

  function removeEntry(item: RelationshipEntry) {
    Alert.alert('Delete this entry?', 'This will remove it from your shared space.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void deleteRelationshipEntry(item.id).then(load).catch((error: any) => {
          Alert.alert('Could not delete this entry', error?.message || 'Please try again.');
        });
      } },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.kicker}>BETWEEN US</Text>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>A few ideas to get started</Text>
          <Text style={styles.help}>Tap one to use it as a title, then write the details yourself.</Text>
          <View style={styles.ideas}>
            {suggestions.map((idea) => (
              <Pressable key={idea} onPress={() => setTitle(idea)} style={[styles.idea, { backgroundColor: config.tint }]} accessibilityRole="button">
                <Text style={[styles.ideaText, { color: config.color }]}>{idea}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Your title</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Or write your own" placeholderTextColor={COLORS.muted} style={styles.input} />
          <Text style={styles.label}>{config.prompt}</Text>
          <TextInput value={body} onChangeText={setBody} maxLength={2000} multiline placeholder="Add your own words…" placeholderTextColor={COLORS.muted} style={[styles.input, styles.bodyInput]} />
          <Text style={styles.privacy}>Saved entries are shared with your connected partner.</Text>
          <Pressable onPress={() => void save()} disabled={saving} style={[styles.save, { backgroundColor: config.color }, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingId ? 'Save changes' : 'Share entry'}</Text>}
          </Pressable>
          {editingId ? <Pressable onPress={() => { setEditingId(null); setTitle(''); setBody(''); }} style={styles.cancelEdit}><Text style={styles.cancelEditText}>Cancel editing</Text></Pressable> : null}
        </View>

        <View style={styles.entriesHeading}>
          <Text style={styles.cardTitle}>Shared entries</Text>
          {loading ? <ActivityIndicator color={config.color} /> : null}
        </View>
        {!loading && items.length === 0 ? <Text style={styles.empty}>Nothing here yet. Add the first entry when you’re ready.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.entry}>
            <View style={styles.entryMeta}>
              <Text style={[styles.author, item.role === role ? styles.authorMine : { color: config.color }]}>{item.role === role ? 'You' : item.role === 'girlfriend' ? 'Girlfriend' : 'Boyfriend'}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            </View>
            <Text style={styles.entryTitle}>{item.title}</Text>
            <Text style={styles.entryBody}>{item.body}</Text>
            {item.role === role ? <View style={styles.entryActions}>
              <Pressable onPress={() => beginEdit(item)} accessibilityRole="button"><Text style={styles.actionText}>Edit</Text></Pressable>
              <Pressable onPress={() => removeEntry(item)} accessibilityRole="button"><Text style={[styles.actionText, styles.deleteText]}>Delete</Text></Pressable>
            </View> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const COLORS = { text: '#282638', muted: '#84808D', border: '#F2E8EB', white: '#FFFFFF', pink: '#E5609F' };
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 38, gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  kicker: { marginTop: 12, color: COLORS.pink, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { marginTop: -7, color: COLORS.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  subtitle: { marginTop: -5, marginBottom: 5, color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  help: { marginTop: 5, marginBottom: 11, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  idea: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14 },
  ideaText: { fontSize: 10, lineHeight: 15, fontWeight: '600' },
  label: { marginTop: 14, marginBottom: 7, color: COLORS.text, fontSize: 11, fontWeight: '600' },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, color: COLORS.text, backgroundColor: '#FFFEFE', fontSize: 13 },
  bodyInput: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  privacy: { marginTop: 9, color: COLORS.muted, fontSize: 10, lineHeight: 15 },
  save: { minHeight: 46, marginTop: 13, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  entriesHeading: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { padding: 16, borderRadius: 16, backgroundColor: COLORS.white, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  entry: { padding: 15, borderRadius: 17, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  entryMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontSize: 10, fontWeight: '700' },
  authorMine: { color: COLORS.pink },
  date: { color: COLORS.muted, fontSize: 10 },
  entryTitle: { marginTop: 9, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  entryBody: { marginTop: 5, color: '#514E5D', fontSize: 13, lineHeight: 19 },
  entryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 12 },
  actionText: { color: COLORS.pink, fontSize: 12, fontWeight: '700' },
  deleteText: { color: '#A65361' },
  cancelEdit: { alignItems: 'center', paddingVertical: 10 },
  cancelEditText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
});
