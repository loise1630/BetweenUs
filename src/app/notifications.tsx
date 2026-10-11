import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimatedCountBadge from '../components/AnimatedCountBadge';
import { getAccountState } from '../lib/account';
import {
  getRelationshipNotifications,
  markRelationshipNotificationsRead,
  RelationshipNotification,
  subscribeRelationshipNotifications,
} from '../lib/relationshipData';

function relativeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<RelationshipNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [account, notifications] = await Promise.all([
        getAccountState(),
        getRelationshipNotifications(),
      ]);
      const partnerId = account.members?.find((member) => member.user_id !== account.user_id)?.user_id;
      setItems(notifications.filter((item) => !!partnerId && item.actor_id === partnerId));
      setError('');
    } catch (reason: any) {
      setError(reason?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      void load();
      void subscribeRelationshipNotifications(() => {
        if (active) void load();
      })
        .then((stop) => {
          if (active) unsubscribe = stop;
          else stop();
        })
        .catch((reason) =>
          console.warn('Notification realtime subscription unavailable:', reason)
        );
      return () => {
        active = false;
        unsubscribe?.();
      };
    }, [load])
  );

  async function open(item: RelationshipNotification) {
    try {
      if (!item.read_at) {
        await markRelationshipNotificationsRead([item.id]);
        setItems((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, read_at: new Date().toISOString() }
              : row
          )
        );
      }
      const route = item.kind === 'shared_checkin'
        ? '/check-in'
        : item.kind === 'shared_want'
          ? '/want'
          : item.kind === 'shared_entry'
            ? '/between-us'
          : item.kind === 'shared_cycle' || item.kind === 'shared_symptom'
            ? '/period'
            : '/messages';
      router.push(route as any);
    } catch (reason: any) {
      Alert.alert(
        'Could not open notification',
        reason?.message || 'Please try again.'
      );
    }
  }

  const unreadCount = items.filter((item) => !item.read_at).length;
  const categories = useMemo(() => [
    { id: 'wants', title: 'Wants', icon: 'star' as const, kinds: ['shared_want'] },
    { id: 'messages', title: 'Messages', icon: 'message-circle' as const, kinds: ['message', 'reply'] },
    { id: 'checkins', title: 'Check-ins', icon: 'heart' as const, kinds: ['shared_checkin'] },
    { id: 'cycle', title: 'Period & Symptoms', icon: 'calendar' as const, kinds: ['shared_cycle', 'shared_symptom'] },
    { id: 'between-us', title: 'Between Us', icon: 'users' as const, kinds: ['shared_entry'] },
  ].map((category) => ({
    ...category,
    items: items.filter((item) => category.kinds.includes(item.kind)),
  })).filter((category) => category.items.length > 0), [items]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <AnimatedCountBadge
            count={unreadCount}
            containerStyle={styles.headerCount}
            textStyle={styles.headerCountText}
          />
          <Pressable
            onPress={() => router.push('/notification-settings')}
            style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
          >
            <Feather name="settings" size={19} color={COLORS.text} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.pink} style={{ marginTop: 48 }} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Notifications unavailable</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void load();
              }}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? null : (
          <View style={styles.categories}>
            {categories.map((category) => {
              const expanded = expandedCategory === category.id;
              const unread = category.items.filter((item) => !item.read_at).length;
              return (
                <View key={category.id} style={styles.category}>
                  <Pressable
                    onPress={() => setExpandedCategory(expanded ? null : category.id)}
                    style={({ pressed }) => [styles.categoryHeader, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View style={styles.categoryIcon}>
                      <Feather name={category.icon} size={17} color={COLORS.pink} />
                    </View>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categoryCount}>{category.items.length}</Text>
                    {unread > 0 ? <View style={styles.categoryUnread}><Text style={styles.categoryUnreadText}>{unread}</Text></View> : null}
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.categoryItems}>
                      {category.items.map((item, index) => (
                        <NotificationRow key={item.id} item={item} index={index} onPress={() => void open(item)} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationRow({
  item,
  index,
  onPress,
}: {
  item: RelationshipNotification;
  index: number;
  onPress: () => void;
}) {
  const [entrance] = useState(() => new Animated.Value(0));
  const [pressScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      delay: Math.min(index * 45, 270),
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const pressTo = (value: number) => {
    Animated.spring(pressScale, {
      toValue: value,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
          { scale: pressScale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => pressTo(0.98)}
        onPressOut={() => pressTo(1)}
        android_ripple={{ color: '#FCE8F1' }}
        accessibilityRole="button"
        style={[styles.row, !item.read_at && styles.rowUnread]}
      >
        <View style={styles.icon}>
          <Feather
            name={item.kind === 'shared_checkin' ? 'heart' : item.kind === 'shared_want' ? 'star' : item.kind === 'shared_entry' ? 'users' : item.kind === 'shared_cycle' || item.kind === 'shared_symptom' ? 'calendar' : 'message-circle'}
            size={18}
            color={COLORS.pink}
          />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>
            {item.kind === 'reply'
              ? 'New reply'
              : item.kind === 'shared_checkin'
                ? 'Shared check-in'
                : item.kind === 'shared_want'
                  ? 'New want'
                  : item.kind === 'shared_cycle'
                    ? 'Period update'
                    : item.kind === 'shared_symptom'
                      ? 'Symptom update'
                      : item.kind === 'shared_entry'
                        ? 'Between Us update'
                      : 'New message'}
          </Text>
          <Text style={styles.rowDescription}>
            {item.kind === 'shared_checkin'
              ? 'Your partner shared a check-in.'
              : item.kind === 'shared_want'
                ? 'Your partner added a want.'
                : item.kind === 'shared_cycle'
                  ? 'Your partner updated period dates.'
                  : item.kind === 'shared_symptom'
                    ? 'Your partner logged a symptom.'
                    : item.kind === 'shared_entry'
                      ? 'Your partner added something to a shared space.'
                    : 'Open your conversation with your partner.'}
          </Text>
          <Text style={styles.date}>{relativeDate(item.created_at)}</Text>
        </View>
        {!item.read_at ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const COLORS = {
  bg: '#FDFDFB',
  text: '#17181C',
  muted: '#6B7280',
  border: '#DCE2EB',
  pink: '#E5609F',
  soft: '#FCE8F1',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 36 },
  categories: { gap: 10 },
  category: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  categoryHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 10,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
  categoryCount: { color: COLORS.muted, fontSize: 12, minWidth: 16, textAlign: 'right' },
  categoryUnread: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryUnreadText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  categoryItems: { paddingHorizontal: 10, paddingBottom: 2, borderTopWidth: 1, borderTopColor: COLORS.border },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    marginBottom: 18,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerCount: {
    minWidth: 23,
    height: 23,
    paddingHorizontal: 6,
    marginRight: 5,
    borderRadius: 12,
    backgroundColor: COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCountText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  settings: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  rowUnread: { borderColor: '#F1B9D2', backgroundColor: '#FFFAFC' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, marginLeft: 12, paddingRight: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowDescription: { marginTop: 4, fontSize: 12, color: COLORS.muted },
  date: { marginTop: 6, fontSize: 10, color: COLORS.muted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.pink },
  empty: { alignItems: 'center', marginTop: 76, paddingHorizontal: 25 },
  emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.muted,
  },
  retry: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.soft,
  },
  retryText: { color: COLORS.pink, fontWeight: '600' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
