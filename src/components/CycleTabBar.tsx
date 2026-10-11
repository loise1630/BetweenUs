import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PINK = '#F4768F';
const MUTED = '#8B8792';

export type CycleTab = 'home' | 'calendar' | 'insights';

export default function CycleTabBar({ active }: { active: CycleTab }) {
  const tabs: { key: CycleTab; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline', route: '/period' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', route: '/period-calendar' },
    { key: 'insights', label: 'Insights', icon: 'bar-chart-outline', route: '/insights' },
  ];

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(tab.route as any);
            }}
            style={styles.item}
          >
            <Ionicons name={tab.icon} size={21} color={selected ? PINK : MUTED} />
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2E8EB',
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 3 },
  label: { fontSize: 10, color: MUTED },
  labelActive: { color: PINK, fontWeight: '700' },
});
