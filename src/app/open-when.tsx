import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../lib/ui';
import { getAccountState } from '../lib/account';
import { addOpenWhenLetter, deleteOpenWhenLetter, getOpenWhenLetters, importOpenWhenLetters, type OpenWhenLetter } from '../lib/openWhen';

type Letter = { id: string; prompt: string; title: string; body: string; createdAt: string; user_id?: string };
const KEY = '@betweenus_open_when_letters_v1';
const PROMPTS = ['Open when you miss me', 'Open when you need a laugh', 'Open when today feels hard', 'Open when you need a reminder'];
const isRemoteId = (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
const toLetter = (letter: OpenWhenLetter): Letter => ({ ...letter, createdAt: letter.created_at });

export default function OpenWhenScreen() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [opened, setOpened] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncIssue, setSyncIssue] = useState(false);

  const load = useCallback(async () => {
    setSyncing(true);
    try {
      const [cachedValue, account] = await Promise.all([AsyncStorage.getItem(KEY), getAccountState()]);
      setMyId(account.user_id ?? null);
      const cached: Letter[] = cachedValue ? JSON.parse(cachedValue) : [];
      try {
        let remote = await getOpenWhenLetters();
        const pending = cached.filter((letter) => !isRemoteId(letter.id));
        if (pending.length) {
          await importOpenWhenLetters(pending);
          remote = await getOpenWhenLetters();
        }
        const next = remote.map(toLetter);
        setLetters(next);
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        setSyncIssue(false);
      } catch {
        setLetters(cached);
        setSyncIssue(true);
      }
    } catch {
      setSyncIssue(true);
      Alert.alert('Could not load letters', 'Your saved letters could not be read. Please try again.');
    } finally {
      setLoaded(true);
      setSyncing(false);
    }
  }, []);

  // Hydrate cached and remote data once the screen mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function cache(next: Letter[]) {
    setLetters(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  async function save() {
    if (!title.trim() || !body.trim()) { Alert.alert('Add your words', 'Write a title and a letter before saving.'); return; }
    try {
      const saved = await addOpenWhenLetter(prompt, title, body);
      const next = [toLetter(saved), ...letters];
      await cache(next);
      setSyncIssue(false);
      setTitle(''); setBody('');
      Alert.alert('Letter saved', 'Your partner can open it from their device.');
    } catch {
      const local: Letter = { id: `${Date.now()}`, prompt, title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() };
      try {
        await cache([local, ...letters]);
        setTitle(''); setBody(''); setSyncIssue(true);
        Alert.alert('Saved on this device', 'This letter has not synced yet. It will sync when the connection and shared letters service are available.');
      } catch { Alert.alert('Could not save', 'Please check available storage and try again.'); }
    }
  }

  function remove(letter: Letter) {
    Alert.alert('Delete this letter?', 'This removes it from the shared letters list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void (async () => {
          try {
            if (isRemoteId(letter.id)) await deleteOpenWhenLetter(letter.id);
            await cache(letters.filter((item) => item.id !== letter.id));
            setOpened(null);
          } catch (error: any) { Alert.alert('Could not delete letter', error?.message || 'Please try again.'); }
        })();
      } },
    ]);
  }

  return <Screen><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color="#302B3B" /><Text style={styles.backText}>Today</Text></Pressable>
    <Text style={styles.title}>Open When Letters</Text>
    <Text style={styles.subtitle}>Write a note for a moment your partner might need it. Synced letters are available on both devices; a local copy keeps them available offline.</Text>
    <Text style={styles.label}>WHEN SHOULD THEY OPEN IT?</Text>
    <View style={styles.prompts}>{PROMPTS.map((item) => <Pressable key={item} onPress={() => setPrompt(item)} style={[styles.chip, prompt === item && styles.chipActive]}><Text style={[styles.chipText, prompt === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="Give your letter a title" placeholderTextColor="#A29DA9" style={styles.input} />
    <TextInput value={body} onChangeText={setBody} maxLength={3000} multiline textAlignVertical="top" placeholder="Write from the heart..." placeholderTextColor="#A29DA9" style={[styles.input, styles.body]} />
    <Pressable onPress={() => void save()} style={styles.button}><Ionicons name="save-outline" size={18} color="white" /><Text style={styles.buttonText}>Save letter</Text></Pressable>
    <View style={styles.savedHeading}><Text style={styles.savedTitle}>{syncIssue ? 'Saved letters · offline copy' : 'Saved letters'} · {loaded ? letters.length : '…'}</Text>{syncing ? <ActivityIndicator size="small" color="#A58BE0" /> : null}</View>
    {syncIssue ? <Text style={styles.syncHint}>Some letters are waiting to sync. Check your connection; shared syncing also needs the latest app database migration.</Text> : null}
    {letters.map((letter) => <View key={letter.id} style={styles.letter}>
      <Pressable onPress={() => setOpened(opened === letter.id ? null : letter.id)} accessibilityRole="button">
        <Text style={styles.prompt}>{letter.prompt}</Text><Text style={styles.letterTitle}>{letter.title}</Text>
        {opened === letter.id ? <Text style={styles.letterBody}>{letter.body}</Text> : <Text style={styles.tap}>Tap to open</Text>}
      </Pressable>
      {(!letter.user_id || letter.user_id === myId) ? <Pressable onPress={() => remove(letter)} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Delete letter"><Ionicons name="trash-outline" size={17} color="#A65361" /></Pressable> : null}
    </View>)}
    {loaded && letters.length === 0 ? <Text style={styles.empty}>Your saved letters will appear here.</Text> : null}
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  page: { padding: 21, paddingBottom: 40 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, backText: { color: '#302B3B', fontSize: 14, fontWeight: '600' },
  title: { marginTop: 22, color: '#282638', fontSize: 26, fontWeight: '700' }, subtitle: { marginTop: 7, color: '#84808D', fontSize: 13, lineHeight: 19 },
  label: { marginTop: 22, marginBottom: 9, color: '#8B8492', fontSize: 10, fontWeight: '700', letterSpacing: 1 }, prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 13 },
  chip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#F2E8EB' }, chipActive: { backgroundColor: '#F2EEFC', borderColor: '#A58BE0' }, chipText: { color: '#777183', fontSize: 11 }, chipTextActive: { color: '#8065C1', fontWeight: '700' },
  input: { marginTop: 10, padding: 13, borderWidth: 1, borderColor: '#F2E8EB', borderRadius: 14, backgroundColor: 'white', color: '#282638', fontSize: 14 }, body: { minHeight: 135, lineHeight: 20 },
  button: { marginTop: 12, height: 48, borderRadius: 24, backgroundColor: '#A58BE0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { color: 'white', fontWeight: '700' },
  savedHeading: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, savedTitle: { color: '#282638', fontSize: 15, fontWeight: '700' }, syncHint: { marginBottom: 12, color: '#9B6A36', fontSize: 11, lineHeight: 17 },
  letter: { position: 'relative', marginBottom: 10, padding: 15, paddingRight: 44, borderRadius: 17, backgroundColor: 'white', borderWidth: 1, borderColor: '#F2E8EB' }, prompt: { color: '#A58BE0', fontSize: 10, fontWeight: '700' }, letterTitle: { marginTop: 6, color: '#282638', fontSize: 15, fontWeight: '700' }, tap: { marginTop: 5, color: '#9993A0', fontSize: 11 }, letterBody: { marginTop: 9, color: '#6E6978', fontSize: 13, lineHeight: 20 },
  deleteButton: { position: 'absolute', top: 12, right: 12, padding: 5 }, empty: { padding: 15, color: '#9993A0', fontSize: 12, textAlign: 'center' },
});
