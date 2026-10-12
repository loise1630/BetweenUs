import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import CycleTabBar from '../components/CycleTabBar';
import { IconButton, PressScale, Screen } from '../lib/ui';

const COLORS = {
  text: '#282638',
  muted: '#84808D',
  border: '#F2E8EB',
  pink: '#F4768F',
  purple: '#A58BE0',
  blue: '#7099E8',
  peach: '#F29A82',
  green: '#70B58E',
  yellow: '#E8B04B',
};

const FEATURES = [
  {
    title: 'Wants',
    description: 'Little things you’d love each other to do.',
    suggestion: 'Try: “Plan a cozy date night.”',
    icon: 'heart-outline' as const,
    color: COLORS.pink,
    tint: '#FEF0F3',
    route: '/want',
  },
  {
    title: 'Unsaid',
    description: 'Put the things that are hard to say into words.',
    suggestion: 'Start with: “I’ve been wanting to tell you…”',
    icon: 'chatbubble-ellipses-outline' as const,
    color: COLORS.purple,
    tint: '#F2EEFC',
    route: '/unsaid',
  },
  {
    title: 'Little Things',
    description: 'Save thoughtful ideas and everyday gestures.',
    suggestion: 'Try: “Make their favorite drink.”',
    icon: 'sparkles-outline' as const,
    color: COLORS.yellow,
    tint: '#FFF7E6',
    route: '/little-things',
  },
  {
    title: 'What I love / hate about you',
    description: 'Share something you appreciate or want to work on.',
    suggestion: 'Start with: “I love when you…”',
    icon: 'rose-outline' as const,
    color: COLORS.peach,
    tint: '#FFF0EB',
    route: '/what-i-love',
  },
  {
    title: 'Our Bucket Lists',
    description: 'Collect plans and experiences to do together.',
    suggestion: 'Try: “Watch the sunrise somewhere new.”',
    icon: 'compass-outline' as const,
    color: COLORS.green,
    tint: '#EAF6EE',
    route: '/bucket-list',
  },
];

export default function BetweenUsScreen() {
  return (
    <Screen>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <IconButton name="arrow-back" onPress={() => router.back()} />
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>YOUR SHARED SPACE</Text>
              <Text style={styles.title}>Between Us</Text>
              <Text style={styles.subtitle}>Small prompts can help you start. Add your own words inside each space.</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {FEATURES.map((feature) => (
              <PressScale
                key={feature.title}
                onPress={() => router.push(feature.route as never)}
                style={styles.card}
                contentStyle={styles.cardContent}
              >
                <View style={[styles.iconWrap, { backgroundColor: feature.tint }]}>
                  <Ionicons name={feature.icon} size={20} color={feature.color} />
                </View>
                <Text style={styles.cardTitle}>{feature.title}</Text>
                <Text style={styles.cardDescription}>{feature.description}</Text>
                <Text style={styles.suggestion}>{feature.suggestion}</Text>
                <View style={styles.openRow}>
                  <Text style={[styles.openText, { color: feature.color }]}>Open</Text>
                  <Ionicons name="arrow-forward" size={15} color={feature.color} />
                </View>
              </PressScale>
            ))}
          </View>
        </ScrollView>
        <CycleTabBar active="between-us" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 22 },
  headerCopy: { flex: 1, paddingTop: 4 },
  kicker: { color: COLORS.pink, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  title: { marginTop: 5, color: COLORS.text, fontSize: 26, fontWeight: '700' },
  subtitle: { marginTop: 5, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 218, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  cardContent: { flex: 1, alignItems: 'flex-start', padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { marginTop: 12, color: COLORS.text, fontSize: 13, fontWeight: '700' },
  cardDescription: { marginTop: 5, color: COLORS.muted, fontSize: 10, lineHeight: 15 },
  suggestion: { flex: 1, marginTop: 10, color: '#777183', fontSize: 10, lineHeight: 15, fontStyle: 'italic' },
  openRow: { width: '100%', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F5EFF1', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openText: { fontSize: 11, fontWeight: '700' },
});
