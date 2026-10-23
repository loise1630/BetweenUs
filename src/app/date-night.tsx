import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../lib/ui';
import { supabase } from '../lib/supabase';

type DateIdea = { title: string; plan: string; budget: string; mood: string };
const IDEAS: DateIdea[] = [
  { title: 'Living room picnic', plan: 'Make a simple snack board, spread a blanket on the floor, and take turns choosing songs that remind you of each other.', budget: 'Low cost', mood: 'Cozy' },
  { title: 'Neighborhood photo walk', plan: 'Pick a nearby street or park, take silly photos for each other, then choose a favorite spot for a drink or merienda.', budget: 'Low cost', mood: 'Playful' },
  { title: 'Cook each other’s favorites', plan: 'Each of you picks one easy dish the other loves. Cook together, plate it nicely, and share one thing you appreciate about the meal.', budget: 'At home', mood: 'Thoughtful' },
  { title: 'Sunset and story swap', plan: 'Find a comfortable sunset spot. Bring water or snacks and trade stories about a favorite childhood memory and a dream for the future.', budget: 'Free', mood: 'Meaningful' },
];

export default function DateNightScreen() {
  const [idea, setIdea] = useState<DateIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('Ready whenever you are, even offline.');

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-date-night');
      if (error) throw error;
      const candidate = data?.idea ?? data;
      if (typeof candidate?.title === 'string' && typeof candidate?.plan === 'string') {
        setIdea({ title: candidate.title, plan: candidate.plan, budget: candidate.budget ?? 'Flexible', mood: candidate.mood ?? 'Made for you' });
        setSource('AI idea');
        return;
      }
      throw new Error('No AI idea returned');
    } catch {
      setIdea(IDEAS[Math.floor(Math.random() * IDEAS.length)]);
      setSource('Offline idea');
    } finally { setLoading(false); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.page}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color="#302B3B" /><Text style={styles.backText}>Between Us</Text></Pressable>
    <View style={styles.hero}><View style={styles.icon}><Ionicons name="sparkles" size={24} color="#E17C69" /></View><Text style={styles.title}>Date Night Generator</Text><Text style={styles.subtitle}>A thoughtful plan for the two of you. Try again for a fresh idea.</Text></View>
    {idea ? <View style={styles.card}><Text style={styles.source}>{source.toUpperCase()} · {idea.mood}</Text><Text style={styles.ideaTitle}>{idea.title}</Text><Text style={styles.plan}>{idea.plan}</Text><View style={styles.budget}><Ionicons name="wallet-outline" size={16} color="#7A6C83" /><Text style={styles.budgetText}>{idea.budget}</Text></View></View> : <View style={styles.empty}><Ionicons name="heart-outline" size={30} color="#E68599" /><Text style={styles.emptyText}>A little inspiration can turn an ordinary evening into your kind of date.</Text></View>}
    <Pressable accessibilityRole="button" disabled={loading} onPress={generate} style={styles.button}>{loading ? <ActivityIndicator color="white" /> : <><Ionicons name="sparkles" size={18} color="white" /><Text style={styles.buttonText}>{idea ? 'Generate another date' : 'Generate a date idea'}</Text></>}</Pressable>
    <Text style={styles.note}>AI ideas need an internet connection. A collection of date ideas is built in for offline use.</Text>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ page: { padding: 22, paddingBottom: 36 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, backText: { color: '#302B3B', fontSize: 14, fontWeight: '600' }, hero: { alignItems: 'center', marginTop: 26, marginBottom: 25 }, icon: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center' }, title: { marginTop: 15, color: '#282638', fontSize: 25, fontWeight: '700', textAlign: 'center' }, subtitle: { marginTop: 8, color: '#84808D', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 300 }, card: { padding: 20, borderRadius: 22, backgroundColor: 'white', borderWidth: 1, borderColor: '#F2E8EB' }, source: { color: '#A58BE0', fontSize: 10, fontWeight: '700', letterSpacing: 1 }, ideaTitle: { marginTop: 10, color: '#282638', fontSize: 20, fontWeight: '700' }, plan: { marginTop: 10, color: '#6E6978', fontSize: 14, lineHeight: 22 }, budget: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 7 }, budgetText: { color: '#7A6C83', fontSize: 12, fontWeight: '600' }, empty: { minHeight: 170, padding: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'white', gap: 13 }, emptyText: { color: '#777183', fontSize: 14, lineHeight: 21, textAlign: 'center' }, button: { marginTop: 18, minHeight: 52, borderRadius: 26, backgroundColor: '#E17C91', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, buttonText: { color: 'white', fontSize: 14, fontWeight: '700' }, note: { marginTop: 13, color: '#9993A0', fontSize: 11, lineHeight: 16, textAlign: 'center' } });
