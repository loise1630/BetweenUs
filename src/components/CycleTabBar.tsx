import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PINK = '#F4768F';
const MUTED = '#8B8792';

export type CycleTab = 'home' | 'calendar' | 'between-us' | 'insights' | 'settings';

export default function CycleTabBar({ active }: { active: CycleTab }) {
  const tabs: { key: CycleTab; label: string; icon: keyof typeof Ionicons.glyphMap; route: string; featured?: boolean }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline', route: '/period' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', route: '/period-calendar' },
    { key: 'between-us', label: 'Between Us', icon: 'people', route: '/between-us', featured: true },
    { key: 'insights', label: 'Insights', icon: 'bar-chart-outline', route: '/insights' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings' },
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
            <View style={[styles.iconWrap, tab.featured && styles.featuredIcon, selected && tab.featured && styles.featuredIconActive]}>
              <Ionicons name={tab.icon} size={tab.featured ? 23 : 21} color={tab.featured || selected ? (tab.featured ? '#FFFFFF' : PINK) : MUTED} />
            </View>
            <Text style={[styles.label, selected && styles.labelActive, tab.featured && styles.featuredLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2E8EB',
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  iconWrap: { width: 32, height: 29, alignItems: 'center', justifyContent: 'center' },
  featuredIcon: { width: 46, height: 46, marginTop: -17, borderRadius: 23, backgroundColor: PINK, borderWidth: 3, borderColor: '#FFFFFF' },
  featuredIconActive: { backgroundColor: '#DE5F7B' },
  label: { fontSize: 10, color: MUTED },
  labelActive: { color: PINK, fontWeight: '700' },
  featuredLabel: { fontWeight: '600' },
});
