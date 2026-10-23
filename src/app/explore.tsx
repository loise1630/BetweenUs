import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SPACES = [
  { title: 'Between Us', detail: 'Shared prompts, lists, and little things', icon: 'heart' as const, route: '/between-us', tint: '#FCE8F1', color: '#E5609F' },
  { title: 'Messages', detail: 'Send a note or reply to your partner', icon: 'message-circle' as const, route: '/messages', tint: '#F2EEFC', color: '#8D72CC' },
  { title: 'Check-in', detail: 'Share how you are feeling today', icon: 'smile' as const, route: '/check-in', tint: '#FFF4E5', color: '#D49A2A' },
  { title: 'Open When Letters', detail: 'Write a note for a moment they may need it', icon: 'mail' as const, route: '/open-when', tint: '#EAF6EE', color: '#65A67E' },
  { title: 'Date Night', detail: 'Find an idea for time together', icon: 'sun' as const, route: '/date-night', tint: '#FFF0EB', color: '#E88970' },
  { title: 'Notifications', detail: 'Catch up on shared updates', icon: 'bell' as const, route: '/notifications', tint: '#EAF2FC', color: '#7099E8' },
];

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>YOUR SHARED SPACE</Text>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Small ways to stay close, one moment at a time.</Text>
        <View style={styles.list}>
          {SPACES.map((space) => (
            <Pressable key={space.route} onPress={() => router.push(space.route as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
              <View style={[styles.icon, { backgroundColor: space.tint }]}><Feather name={space.icon} size={19} color={space.color} /></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{space.title}</Text><Text style={styles.detail}>{space.detail}</Text></View>
              <Feather name="chevron-right" size={19} color="#B4AAB0" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9FB' },
  page: { padding: 22, paddingBottom: 36 },
  kicker: { marginTop: 16, color: '#E5609F', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { marginTop: 7, color: '#30282D', fontSize: 29, fontWeight: '700' },
  subtitle: { marginTop: 6, marginBottom: 22, color: '#8E7F87', fontSize: 13, lineHeight: 20 },
  list: { gap: 11 },
  card: { minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E1E6' },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 12, marginRight: 10 },
  cardTitle: { color: '#342C31', fontSize: 14, fontWeight: '700' },
  detail: { marginTop: 4, color: '#92828A', fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.75 },
});
