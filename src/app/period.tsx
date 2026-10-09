import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addDays,
  calculatePeriodLength,
  createPeriod,
  CyclePhase,
  deletePeriod,
  deletePeriodSymptom,
  getCurrentCycleInfo,
  getCycleInfoForDate,
  getPeriodDashboard,
  getPredictedNextPeriod,
  getTodaySymptoms,
  parseDate,
  PeriodDashboard,
  PeriodLog,
  PeriodSettings,
  savePeriodSymptom,
  SymptomSeverity,
  updatePeriod,
} from '../lib/period';

import { getAccountState } from '../lib/account';

// ⚠️ Adjust these names if your partnerMessages.ts exports different ones.
import {
  getPartnerMessages,
  markPartnerMessagesRead,
  PartnerMessage,
  sendPartnerMessage,
} from '../lib/partnerMessages';

import { FadeIn, IconButton, PressScale, Screen } from '../lib/ui';

const PHASE_IMAGES: Record<CyclePhase, any> = {
  Period: require('../../assets/images/menstrual.png'),
  Follicular: require('../../assets/images/follicular-phase.png'),
  Ovulation: require('../../assets/images/ovulation-phase.png'),
  Luteal: require('../../assets/images/luteal-phase.png'),
};

// ⚠️ The four new routes below (littleThings, loveAboutYou, bucketList, checkIn)
// need matching screen files in your app folder, e.g. app/little-things.tsx
const ROUTES = {
  want: '/want',
  unsaid: '/unsaid',
  insights: '/insights',
  calendar: '/period-calendar',
  littleThings: '/little-things',
  loveAboutYou: '/what-i-love',
  bucketList: '/bucket-list',
  checkIn: '/check-in',
};

const C = {
  bg: '#FBF1F2',
  card: 'rgba(255,255,255,0.82)',
  white: '#FFFFFF',
  text: '#20273A',
  muted: '#7C8294',
  faint: '#A8ADBB',
  pink: '#F4768F',
  pinkSoft: '#FDE7EC',
  pinkBorder: '#F7D8DF',
  purple: '#A58BE0',
  purpleSoft: '#F0EBFB',
  blue: '#7099E8',
  blueSoft: '#EAF0FC',
  peach: '#F29A82',
  peachSoft: '#FDECE7',
  green: '#70B58E',
  greenSoft: '#E6F4EC',
  yellow: '#E8B04B',
  yellowSoft: '#FBF1DB',
  line: '#F0E3E6',
};

type GradientStop = { at: number; color: string };

const PHASE_THEME: Record<
  CyclePhase,
  { stops: GradientStop[]; ink: string }
> = {
  Period: {
    stops: [
      { at: 0, color: '#FCF3F4' },
      { at: 0.5, color: '#F4C4CC' },
      { at: 1, color: '#FCF1F2' },
    ],
    ink: '#8A3A50',
  },
  Follicular: {
    stops: [
      { at: 0, color: '#F4FAF6' },
      { at: 0.5, color: '#C7E4D2' },
      { at: 1, color: '#F4FAF6' },
    ],
    ink: '#2F6B4B',
  },
  Ovulation: {
    stops: [
      { at: 0, color: '#FEF6F2' },
      { at: 0.5, color: '#F8CFC0' },
      { at: 1, color: '#FEF5F1' },
    ],
    ink: '#8C4A36',
  },
  Luteal: {
    stops: [
      { at: 0, color: '#F7F4FD' },
      { at: 0.5, color: '#D7CBF0' },
      { at: 1, color: '#F7F4FD' },
    ],
    ink: '#5A4390',
  },
};

const PHASE_COPY: Record<
  CyclePhase,
  {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    line1: string;
    line2: string;
  }
> = {
  Period: {
    title: 'Menstruation',
    icon: 'water-outline',
    accent: C.pink,
    line1: 'Your body is renewing.',
    line2: 'Take it easy today.',
  },
  Follicular: {
    title: 'Follicular',
    icon: 'leaf-outline',
    accent: C.green,
    line1: 'Your energy is building.',
    line2: 'A fresh start is here.',
  },
  Ovulation: {
    title: 'Ovulation',
    icon: 'flower-outline',
    accent: C.peach,
    line1: 'You may feel more energetic.',
    line2: 'Enjoy the extra energy.',
  },
  Luteal: {
    title: 'Luteal',
    icon: 'moon-outline',
    accent: C.purple,
    line1: 'Time to slow down.',
    line2: 'Be gentle with yourself.',
  },
};

const SYMPTOM_OPTIONS = [
  'Cramps',
  'Headache',
  'Bloating',
  'Fatigue',
  'Back pain',
  'Cravings',
  'Nausea',
  'Breast tenderness',
];

const MOOD_OPTIONS = ['Happy', 'Calm', 'Sad', 'Anxious', 'Irritable'];
const SEVERITY_OPTIONS: SymptomSeverity[] = ['mild', 'moderate', 'strong'];

const GF_QUICK_MESSAGES = [
  'Can you bring me snacks?',
  'I need a hug today',
  "I'm not feeling okay",
  'Please be extra patient with me',
];

const BF_QUICK_MESSAGES = [
  'Thinking of you ❤️',
  'Need anything? I got you',
  'Want me to bring food?',
  'Rest well, babe',
];

const MESSAGE_MAX = 280;

const FALLBACK_SETTINGS: PeriodSettings = {
  tracking_enabled: true,
  average_cycle_length: 28,
  average_period_length: 5,
};

type NotificationItem = {
  id: string;
  kind: 'message' | 'reply';
  title: string;
  body: string;
  quoted: string | null;
  createdAt: string;
  unread: boolean;
  message: PartnerMessage;
};

function todayString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not enough data';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function timeAgo(value: string | null | undefined) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);

  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function colorAt(stops: GradientStop[], t: number) {
  if (t <= stops[0].at) return stops[0].color;

  const last = stops[stops.length - 1];
  if (t >= last.at) return last.color;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];

    if (t >= a.at && t <= b.at) {
      const k = (t - a.at) / (b.at - a.at || 1);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);

      return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * k)},${Math.round(
        ca[1] + (cb[1] - ca[1]) * k
      )},${Math.round(ca[2] + (cb[2] - ca[2]) * k)})`;
    }
  }

  return last.color;
}

function detectRole(account: any): 'girlfriend' | 'boyfriend' | 'unknown' {
  const role = String(
    account?.role ??
      account?.user_role ??
      account?.relationship_role ??
      account?.account_role ??
      ''
  )
    .trim()
    .toLowerCase();

  if (role === 'girlfriend' || role === 'girl' || role === 'female') {
    return 'girlfriend';
  }

  if (role === 'boyfriend' || role === 'boy' || role === 'male') {
    return 'boyfriend';
  }

  return 'unknown';
}

function detectPartnerName(account: any): string {
  const raw =
    account?.partner_username ??
    account?.partner_name ??
    account?.partner?.username ??
    account?.partner?.name ??
    account?.partner?.display_name ??
    '';

  const clean = String(raw || '').trim().replace(/^@/, '');
  return clean ? `@${clean}` : 'Your partner';
}

function partnerHasData(data: PeriodDashboard | null) {
  return !!(
    data?.partner &&
    ((data.partner.periods?.length || 0) > 0 ||
      data.partner.settings?.latest_period_start)
  );
}

export default function PeriodScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [dashboard, setDashboard] = useState<PeriodDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewerMode, setViewerMode] = useState(false);
  const [ready, setReady] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [symptomModal, setSymptomModal] = useState(false);
  const [symptomType, setSymptomType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [mood, setMood] = useState<string | null>(null);

  // Messages + notifications
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Your partner');
  const [notifOpen, setNotifOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [replyTo, setReplyTo] = useState<PartnerMessage | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const symptomsY = useRef(0);
  const logsY = useRef(0);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(1)).current;

  const loadDashboard = useCallback(async () => {
    try {
      const data = await getPeriodDashboard();
      setDashboard(data);
    } catch (error: any) {
      console.error('PERIOD LOAD ERROR:', error);
      Alert.alert(
        'Unable to load period data',
        error?.message || 'Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getPartnerMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('PARTNER MESSAGES LOAD ERROR:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function boot() {
        setLoading(true);

        try {
          const account: any = await getAccountState();
          let role = detectRole(account);
          let preloaded: PeriodDashboard | null = null;

          setMyId(account?.user_id || account?.id || null);
          setPartnerName(detectPartnerName(account));

          if (role === 'unknown') {
            preloaded = await getPeriodDashboard();
            role =
              partnerHasData(preloaded) &&
              (preloaded.own.periods?.length || 0) === 0
                ? 'boyfriend'
                : 'girlfriend';
          }

          if (!mounted) return;

          const isBoyfriend = role === 'boyfriend';
          setViewerMode(isBoyfriend);

          if (!isBoyfriend) {
            const userId = account?.user_id || account?.id || null;
            const setupKey = userId
              ? `@betweenus_period_setup_v1_${userId}`
              : '@betweenus_period_setup_v1';

            const setupComplete = await AsyncStorage.getItem(setupKey);

            if (!setupComplete && mounted) {
              router.replace('/period-setup');
              return;
            }
          }

          if (!mounted) return;

          setReady(true);
          void loadMessages();

          if (preloaded) {
            setDashboard(preloaded);
            setLoading(false);
          } else {
            await loadDashboard();
          }
        } catch (error) {
          console.error('PERIOD BOOT ERROR:', error);

          if (mounted) {
            setReady(true);
            void loadMessages();
            await loadDashboard();
          }
        }
      }

      void boot();

      // Refresh messages every 30s while this screen is focused
      const interval = setInterval(() => {
        void loadMessages();
      }, 30000);

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [loadDashboard, loadMessages])
  );

  const ownPeriods = dashboard?.own?.periods || [];
  const ownSymptoms = dashboard?.own?.symptoms || [];
  const ownSettings = dashboard?.own?.settings || null;

  const partner = dashboard?.partner || null;
  const partnerSettings = partner?.settings || null;
  const partnerPeriodsRaw = partner?.periods || [];
  const partnerSymptoms = partner?.symptoms || [];

  const partnerLatestStart = partnerSettings?.latest_period_start ?? null;

  const partnerPeriods: PeriodLog[] =
    partnerPeriodsRaw.length > 0
      ? partnerPeriodsRaw
      : partnerLatestStart
        ? [
            {
              id: 'shared-summary',
              start_date: partnerLatestStart,
              end_date: null,
              notes: null,
            },
          ]
        : [];

  const periods: PeriodLog[] = viewerMode ? partnerPeriods : ownPeriods;
  const symptoms = viewerMode ? partnerSymptoms : ownSymptoms;

  const baseSettings = ownSettings || FALLBACK_SETTINGS;

  const settings: PeriodSettings = viewerMode
    ? {
        ...FALLBACK_SETTINGS,
        average_cycle_length:
          partnerSettings?.average_cycle_length || 28,
        average_period_length:
          partnerSettings?.average_period_length || 5,
      }
    : baseSettings;

  const today = todayString();
  const hasCycleData = periods.length > 0;
  const cycleLength = settings.average_cycle_length || 28;
  const periodLength = settings.average_period_length || 5;

  const latestPeriod = useMemo(
    () =>
      [...periods].sort((a, b) =>
        b.start_date.localeCompare(a.start_date)
      )[0] || null,
    [periods]
  );

  const currentCycle = getCurrentCycleInfo(periods, settings);

  const stripStart =
    latestPeriod && currentCycle.cycleDay && currentCycle.cycleDay <= 10
      ? latestPeriod.start_date
      : today;

  const stripDates = Array.from({ length: 10 }, (_, i) =>
    addDays(stripStart, i)
  );

  const activeDate =
    selectedDate && stripDates.includes(selectedDate)
      ? selectedDate
      : stripDates.includes(today)
        ? today
        : stripDates[0];

  const activeInfo = getCycleInfoForDate(periods, settings, activeDate);
  const activePhase: CyclePhase = activeInfo.phase || 'Period';
  const shownPhase: CyclePhase = hasCycleData ? activePhase : 'Period';
  const activeCopy = PHASE_COPY[shownPhase];
  const theme = PHASE_THEME[shownPhase];
  const accent = activeCopy.accent;

  const predictedNext =
    viewerMode && partnerSettings?.predicted_next_period
      ? partnerSettings.predicted_next_period
      : getPredictedNextPeriod(periods, cycleLength);

  const todaySymptoms = getTodaySymptoms(symptoms);

  const loggedPeriodLength = latestPeriod
    ? calculatePeriodLength(latestPeriod)
    : null;

  const displayPeriodLength = loggedPeriodLength || periodLength;

  // Notifications: only messages sent by my partner (not by me)
  const notifications: NotificationItem[] = useMemo(() => {
    const byId = new Map<string, PartnerMessage>();
    messages.forEach((m) => byId.set(String(m.id), m));

    return messages
      .filter((m) => (myId ? m.sender_id !== myId : true))
      .map((m) => {
        const target = m.reply_to_id ? byId.get(String(m.reply_to_id)) : null;
        const isReplyToMine =
          !!target && (myId ? target.sender_id === myId : true);

        return {
          id: String(m.id),
          kind: isReplyToMine ? ('reply' as const) : ('message' as const),
          title: isReplyToMine
            ? `${partnerName} replied to your message`
            : `Message from ${partnerName}`,
          body: m.body,
          quoted: isReplyToMine && target ? target.body : null,
          createdAt: m.created_at,
          unread: !m.read_at,
          message: m,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [messages, myId, partnerName]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const imgSize = Math.min(width * 0.78, 350);
  const heroHeight = imgSize * 0.7;

  const popImage = useCallback(() => {
    popAnim.setValue(0.94);
    Animated.spring(popAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [popAnim]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  useEffect(() => {
    popImage();
  }, [activeDate, shownPhase, popImage]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  function scrollTo(y: number) {
    scrollRef.current?.scrollTo({
      y: Math.max(y - 12, 0),
      animated: true,
    });
  }

  function openRoute(route: string) {
    router.push(route as any);
  }

  async function refresh() {
    setLoading(true);
    await loadDashboard();
  }

  /* MESSAGES */

  function openCompose(reply: PartnerMessage | null = null) {
    setReplyTo(reply);
    setComposeText('');
    setComposeOpen(true);
  }

  function closeCompose() {
    setComposeOpen(false);
    setReplyTo(null);
    setComposeText('');
  }

  async function sendMessage() {
    const body = composeText.trim();

    if (!body) {
      Alert.alert('Write something', 'Type your message first.');
      return;
    }

    try {
      setSaving(true);
      await sendPartnerMessage(body, replyTo ? String(replyTo.id) : null);
      closeCompose();
      await loadMessages();
    } catch (error: any) {
      Alert.alert(
        'Could not send message',
        error?.message || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;

    setMessages((prev) =>
      prev.map((m) =>
        ids.includes(String(m.id))
          ? { ...m, read_at: m.read_at || new Date().toISOString() }
          : m
      )
    );

    try {
      await markPartnerMessagesRead(ids);
    } catch (error) {
      console.error('MARK READ ERROR:', error);
    }
  }

  async function markAllRead() {
    const ids = notifications.filter((n) => n.unread).map((n) => n.id);
    await markRead(ids);
  }

  function openNotification(item: NotificationItem) {
    if (item.unread) void markRead([item.id]);

    setNotifOpen(false);
    setTimeout(() => openCompose(item.message), 300);
  }

  /* PERIOD ACTIONS */

  async function addTodayPeriod() {
    if (viewerMode) return;

    if (ownPeriods.some((p) => p.start_date === today)) {
      Alert.alert(
        'Already logged',
        'Today is already saved as a period start.'
      );
      return;
    }

    try {
      setSaving(true);
      await createPeriod(today, null, '');
      await refresh();
      Alert.alert('Period started', 'Today has been saved.');
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function editPeriod() {
    if (viewerMode) return;

    const latest =
      [...ownPeriods].sort((a, b) =>
        b.start_date.localeCompare(a.start_date)
      )[0] || null;

    const buttons: any[] = [];

    if (latest && !latest.end_date && latest.start_date <= today) {
      buttons.push({
        text: 'End period today',
        onPress: async () => {
          try {
            setSaving(true);
            await updatePeriod(
              latest.id,
              latest.start_date,
              today,
              latest.notes || ''
            );
            await refresh();
          } catch (error: any) {
            Alert.alert(
              'Could not update',
              error?.message || 'Please try again.'
            );
          } finally {
            setSaving(false);
          }
        },
      });
    }

    buttons.push({
      text: 'Start period today',
      onPress: addTodayPeriod,
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Manage period',
      latest ? 'Update your current period.' : 'Start tracking your period.',
      buttons
    );
  }

  function deleteOwnPeriod(period: PeriodLog) {
    if (viewerMode) return;

    Alert.alert('Delete this period?', 'This removes the period entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deletePeriod(period.id);
            await refresh();
          } catch (error: any) {
            Alert.alert(
              'Could not delete',
              error?.message || 'Please try again.'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function saveSymptom() {
    if (viewerMode) return;

    if (!symptomType) {
      Alert.alert('Pick a symptom', 'Choose a symptom first.');
      return;
    }

    try {
      setSaving(true);

      await savePeriodSymptom({
        symptomDate: today,
        symptomType,
        severity,
        mood,
      });

      setSymptomType(null);
      setMood(null);
      setSeverity('mild');
      setSymptomModal(false);

      await refresh();
    } catch (error: any) {
      Alert.alert(
        'Could not save symptom',
        error?.message || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSymptom(id: string) {
    if (viewerMode) return;

    try {
      setSaving(true);
      await deletePeriodSymptom(id);
      await refresh();
    } catch (error: any) {
      Alert.alert(
        'Could not delete symptom',
        error?.message || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={C.pink} />
        </View>
      </Screen>
    );
  }

  if (!dashboard) {
    return (
      <Screen>
        <View style={styles.emptyScreen}>
          <Ionicons
            name="calendar-outline"
            size={36}
            color={C.pink}
          />
          <Text style={styles.emptyTitle}>Unable to load your cycle</Text>
          <Text style={styles.emptyDescription}>
            Check your connection and try again.
          </Text>
          <Pressable onPress={refresh} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const quickMessages = viewerMode ? BF_QUICK_MESSAGES : GF_QUICK_MESSAGES;

  return (
    <Screen>
      <View style={styles.root}>
        <SoftGradient stops={theme.stops} />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: 120 + insets.bottom },
          ]}
        >
          {/* HEADER */}
          <FadeIn style={styles.header}>
            <View style={styles.headerTitleGroup}>
              {router.canGoBack?.() ? (
                <IconButton name="arrow-back" onPress={() => router.back()} />
              ) : null}

              <View style={styles.headerTextGroup}>
                <Text style={[styles.eyebrow, { color: theme.ink }]}>
                  BETWEEN US
                </Text>
                <Text style={[styles.headerTitle, { color: theme.ink }]}>
                  {viewerMode ? 'Her cycle' : 'Your cycle'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Small steps, big care.
                </Text>
              </View>
            </View>

            <PressScale
              onPress={() => setNotifOpen(true)}
              style={styles.headerCalendar}
              contentStyle={styles.headerCalendarContent}
            >
              <Ionicons
                name={
                  unreadCount > 0 ? 'notifications' : 'notifications-outline'
                }
                size={22}
                color={theme.ink}
              />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </PressScale>
          </FadeIn>

          {/* DATE STRIP */}
          <FadeIn delay={40}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
            >
              {stripDates.map((date) => {
                const active = date === activeDate;
                const info = getCycleInfoForDate(periods, settings, date);
                const number =
                  hasCycleData && info.cycleDay
                    ? String(info.cycleDay)
                    : String(parseDate(date).getDate());
                const isPeriodDay = hasCycleData && info.phase === 'Period';

                return (
                  <Pressable
                    key={date}
                    onPress={() => setSelectedDate(date)}
                    style={styles.dateItem}
                  >
                    <Text
                      style={[
                        styles.dateWeekday,
                        active && { color: theme.ink },
                      ]}
                    >
                      {parseDate(date).toLocaleDateString(undefined, {
                        weekday: 'short',
                      })}
                    </Text>

                    <View
                      style={[
                        styles.dateCircle,
                        active && { backgroundColor: accent },
                        !active && isPeriodDay && styles.dateCirclePeriod,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateNumber,
                          active && styles.dateNumberActive,
                          !active && isPeriodDay && { color: C.pink },
                        ]}
                      >
                        {number}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.dateDot,
                        {
                          backgroundColor: isPeriodDay ? C.pink : 'transparent',
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeIn>

          {/* CYCLE HERO */}
          <FadeIn delay={80}>
            <View style={styles.hero}>
              <View
                style={[
                  styles.heroImageArea,
                  { height: heroHeight, width: width - 40 },
                ]}
              >
                <View
                  style={[
                    styles.heroGlow,
                    { backgroundColor: accent },
                  ]}
                />

                <Pressable onPress={popImage}>
                  <Animated.View
                    style={{
                      width: imgSize,
                      height: imgSize,
                      transform: [
                        { translateY: floatY },
                        { scale: popAnim },
                      ],
                    }}
                  >
                    <Image
                      source={PHASE_IMAGES[shownPhase]}
                      style={styles.heroImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </Pressable>
              </View>

              <Text style={[styles.heroEyebrow, { color: theme.ink }]}>
                MENSTRUAL CYCLE PHASE
              </Text>

              <Text style={[styles.heroPhase, { color: theme.ink }]}>
                {hasCycleData ? PHASE_COPY[activePhase].title : 'No cycle yet'}
              </Text>

              <Text style={[styles.heroDay, { color: theme.ink }]}>
                {hasCycleData && activeInfo.cycleDay
                  ? `Day ${activeInfo.cycleDay} of ${cycleLength}`
                  : hasCycleData
                    ? 'Upcoming cycle'
                    : 'Nothing logged yet'}
              </Text>

              <Text style={[styles.heroDescription, { color: theme.ink }]}>
                {hasCycleData
                  ? `${PHASE_COPY[activePhase].line1}\n${PHASE_COPY[activePhase].line2}`
                  : viewerMode
                    ? 'Her cycle information will appear here once she logs a period.'
                    : 'Log your first period to begin tracking.'}
              </Text>

              {!viewerMode ? (
                <PressScale
                  onPress={editPeriod}
                  style={styles.managePeriodButton}
                  contentStyle={styles.managePeriodButtonContent}
                >
                  <Ionicons name="create-outline" size={17} color={theme.ink} />
                  <Text style={[styles.managePeriodText, { color: theme.ink }]}>
                    Manage period
                  </Text>
                </PressScale>
              ) : null}
            </View>
          </FadeIn>

          {/* QUICK FEATURE ROW — HORIZONTAL */}
          <FadeIn delay={130}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Your tools</Text>
              <Text style={styles.sectionHint}>Swipe to explore</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.featureScroller}
            >
              <FeatureCard
                title="Calendar"
                subtitle="Your cycle at a glance"
                icon="calendar-outline"
                color={C.peach}
                background={C.peachSoft}
                onPress={() => openRoute(ROUTES.calendar)}
              />

              <FeatureCard
                title="Symptoms"
                subtitle={viewerMode ? 'View logged symptoms' : 'Track how you feel'}
                icon="heart-outline"
                color={C.purple}
                background={C.purpleSoft}
                onPress={() => {
                  if (viewerMode) {
                    scrollTo(symptomsY.current);
                  } else {
                    setSymptomModal(true);
                  }
                }}
              />

              <FeatureCard
                title="Period Logs"
                subtitle="Your period history"
                icon="time-outline"
                color={C.pink}
                background={C.pinkSoft}
                onPress={() => scrollTo(logsY.current)}
              />
            </ScrollView>
          </FadeIn>

          {/* TODAY: RELATIONSHIP FEATURES — HORIZONTAL */}
          <FadeIn delay={180}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Between Us</Text>
              <Text style={styles.todayCaption}>
                {unreadCount > 0
                  ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}`
                  : todaySymptoms.length > 0
                    ? `${todaySymptoms.length} symptom update${todaySymptoms.length === 1 ? '' : 's'}`
                    : 'A little space for the two of you'}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.todayScroller}
            >
              <RelationshipCard
                title="Want"
                subtitle={
                  viewerMode
                    ? "See what she'd love."
                    : "Tell him what you'd love."
                }
                icon="heart"
                background={C.pinkSoft}
                color={C.pink}
                onPress={() => openRoute(ROUTES.want)}
              />

              <RelationshipCard
                title="Unsaid"
                subtitle="Things you can't say directly."
                icon="chatbubble-ellipses"
                background={C.purpleSoft}
                color={C.purple}
                onPress={() => openRoute(ROUTES.unsaid)}
              />

              <RelationshipCard
                title="Message"
                subtitle={
                  viewerMode
                    ? 'Send her a sweet note.'
                    : 'Send him a message.'
                }
                icon="mail"
                background={C.blueSoft}
                color={C.blue}
                badge={unreadCount}
                onPress={() => openCompose(null)}
              />

              <RelationshipCard
                title="Little Things"
                subtitle={
                  viewerMode
                    ? 'Small ways to make her day.'
                    : 'Small things that make you smile.'
                }
                icon="sparkles"
                background={C.yellowSoft}
                color={C.yellow}
                onPress={() => openRoute(ROUTES.littleThings)}
              />

              <RelationshipCard
                title="What I love about you"
                subtitle={
                  viewerMode
                    ? 'Tell her what you adore.'
                    : 'Tell him what you adore.'
                }
                icon="rose"
                background={C.peachSoft}
                color={C.peach}
                onPress={() => openRoute(ROUTES.loveAboutYou)}
              />

              <RelationshipCard
                title="Our Bucket Lists"
                subtitle="Dreams and plans, together."
                icon="compass"
                background={C.greenSoft}
                color={C.green}
                onPress={() => openRoute(ROUTES.bucketList)}
              />

              <RelationshipCard
                title="Check-in"
                subtitle="How are you feeling about your partner?"
                icon="pulse"
                background={C.blueSoft}
                color={C.blue}
                onPress={() => openRoute(ROUTES.checkIn)}
              />
            </ScrollView>
          </FadeIn>

          {/* CYCLE SUMMARY */}
          <FadeIn delay={220}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Cycle overview</Text>
            </View>

            <View style={styles.summaryRow}>
              <SummaryCard
                icon="calendar-outline"
                label="Next expected"
                value={formatDate(predictedNext)}
                color={C.pink}
              />
              <SummaryCard
                icon="repeat-outline"
                label="Cycle length"
                value={`${cycleLength} days`}
                color={C.purple}
              />
              <SummaryCard
                icon="water-outline"
                label="Period length"
                value={`${displayPeriodLength} days`}
                color={C.peach}
              />
            </View>
          </FadeIn>

          {/* SYMPTOMS */}
          <View
            onLayout={(event) => {
              symptomsY.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Symptoms</Text>
              {!viewerMode ? (
                <Pressable
                  onPress={() => setSymptomModal(true)}
                  style={styles.smallAction}
                >
                  <Ionicons name="add" size={16} color={C.pink} />
                  <Text style={styles.smallActionText}>Add</Text>
                </Pressable>
              ) : null}
            </View>

            {todaySymptoms.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="heart-outline"
                    size={23}
                    color={C.purple}
                  />
                </View>
                <Text style={styles.emptyCardTitle}>
                  {viewerMode ? 'No symptoms logged today' : 'How are you feeling?'}
                </Text>
                <Text style={styles.emptyCardDescription}>
                  {viewerMode
                    ? 'Her logged symptoms will appear here.'
                    : 'Keep track of symptoms, mood and how you feel.'}
                </Text>
                {!viewerMode ? (
                  <Pressable
                    onPress={() => setSymptomModal(true)}
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>Log symptoms</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.symptomList}>
                {todaySymptoms.map((item) => (
                  <View key={item.id} style={styles.symptomRow}>
                    <View style={styles.symptomIcon}>
                      <Ionicons
                        name="heart"
                        size={17}
                        color={C.purple}
                      />
                    </View>

                    <View style={styles.symptomText}>
                      <Text style={styles.symptomName}>
                        {item.symptom_type}
                      </Text>
                      <Text style={styles.symptomDetail}>
                        {capitalize(item.severity)}
                        {item.mood ? ` · ${item.mood}` : ''}
                      </Text>
                    </View>

                    {!viewerMode ? (
                      <Pressable
                        onPress={() => removeSymptom(item.id)}
                        hitSlop={10}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={21}
                          color={C.faint}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* PERIOD LOGS: COMPACT LIST */}
          <View
            onLayout={(event) => {
              logsY.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Period Logs</Text>
              <Text style={styles.sectionHint}>
                {periods.length} entr{periods.length === 1 ? 'y' : 'ies'}
              </Text>
            </View>

            {periods.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="time-outline"
                    size={23}
                    color={C.pink}
                  />
                </View>
                <Text style={styles.emptyCardTitle}>No period logs yet</Text>
                <Text style={styles.emptyCardDescription}>
                  {viewerMode
                    ? 'Her period history will appear here once she logs a period.'
                    : 'Your saved period entries will appear here.'}
                </Text>
                {!viewerMode ? (
                  <Pressable
                    onPress={editPeriod}
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>Log a period</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.logsCard}>
                {periods.slice(0, 3).map((period, index) => (
                  <View
                    key={period.id}
                    style={[
                      styles.logRow,
                      index < Math.min(periods.length, 3) - 1 &&
                        styles.logRowBorder,
                    ]}
                  >
                    <View style={styles.logDateIcon}>
                      <Ionicons
                        name="calendar-outline"
                        size={19}
                        color={C.pink}
                      />
                    </View>

                    <View style={styles.logText}>
                      <Text style={styles.logTitle}>
                        {formatDate(period.start_date)}
                      </Text>
                      <Text style={styles.logSubtitle}>
                        {period.end_date
                          ? `Ended ${formatDate(period.end_date)}`
                          : period.start_date === latestPeriod?.start_date
                            ? 'Current or ongoing period'
                            : 'End date not recorded'}
                      </Text>
                    </View>

                    {!viewerMode && period.id !== 'shared-summary' ? (
                      <Pressable
                        onPress={() => deleteOwnPeriod(period)}
                        hitSlop={10}
                        style={styles.deleteButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color={C.faint}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}

                {periods.length > 3 ? (
                  <View style={styles.moreLogs}>
                    <Text style={styles.moreLogsText}>
                      Showing 3 of {periods.length} entries
                    </Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Period Logs',
                          `There are ${periods.length} saved entries. The full history page can be added next.`
                        )
                      }
                    >
                      <Text style={styles.moreLogsLink}>View all</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {!viewerMode ? (
            <View style={styles.sharedNote}>
              <Ionicons name="heart-outline" size={19} color={C.pink} />
              <View style={styles.sharedNoteText}>
                <Text style={styles.sharedNoteTitle}>
                  Shared with your partner
                </Text>
                <Text style={styles.sharedNoteDescription}>
                  Your cycle and logged symptoms can help your partner
                  understand how to support you.
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* BOTTOM NAVIGATION */}
        <View
          style={[
            styles.tabBar,
            { paddingBottom: Math.max(insets.bottom, 14) + 4 },
          ]}
        >
          <TabItem
            label="Home"
            icon="home"
            active
            color={accent}
            onPress={() =>
              scrollRef.current?.scrollTo({ y: 0, animated: true })
            }
          />
          <TabItem
            label="Calendar"
            icon="calendar-outline"
            color={accent}
            onPress={() => openRoute(ROUTES.calendar)}
          />
          <TabItem
            label="Insights"
            icon="bar-chart-outline"
            color={accent}
            onPress={() => openRoute(ROUTES.insights)}
          />
        </View>

        {/* SYMPTOM MODAL */}
        <Modal
          visible={symptomModal && !viewerMode}
          transparent
          animationType="slide"
          onRequestClose={() => setSymptomModal(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setSymptomModal(false)}
            />

            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScroll}
              >
                <Text style={styles.sheetTitle}>Symptoms</Text>
                <Text style={styles.sheetSubtitle}>
                  How are you feeling today?
                </Text>

                {todaySymptoms.length > 0 ? (
                  <View style={styles.loggedBlock}>
                    <Text style={styles.sheetLabel}>Logged today</Text>
                    {todaySymptoms.map((item) => (
                      <View key={item.id} style={styles.loggedRow}>
                        <Text style={styles.loggedText}>
                          {item.symptom_type} · {capitalize(item.severity)}
                          {item.mood ? ` · ${item.mood}` : ''}
                        </Text>
                        <Pressable
                          onPress={() => removeSymptom(item.id)}
                          hitSlop={10}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color={C.faint}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.sheetLabel}>Choose a symptom</Text>
                <View style={styles.chipWrap}>
                  {SYMPTOM_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setSymptomType(option)}
                      style={[
                        styles.chip,
                        symptomType === option && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          symptomType === option && styles.chipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>Severity</Text>
                <View style={styles.chipWrap}>
                  {SEVERITY_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setSeverity(option)}
                      style={[
                        styles.chip,
                        severity === option && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          severity === option && styles.chipTextActive,
                        ]}
                      >
                        {capitalize(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>Mood (optional)</Text>
                <View style={styles.chipWrap}>
                  {MOOD_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() =>
                        setMood(mood === option ? null : option)
                      }
                      style={[
                        styles.chip,
                        mood === option && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          mood === option && styles.chipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={saveSymptom}
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>Save symptom</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSymptomModal(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* NOTIFICATIONS MODAL */}
        <Modal
          visible={notifOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setNotifOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setNotifOpen(false)}
            />

            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScroll}
              >
                <View style={styles.notifHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Notifications</Text>
                    <Text style={styles.sheetSubtitle}>
                      {unreadCount > 0
                        ? `${unreadCount} unread`
                        : "You're all caught up"}
                    </Text>
                  </View>

                  {unreadCount > 0 ? (
                    <Pressable onPress={markAllRead} style={styles.smallAction}>
                      <Ionicons name="checkmark-done" size={15} color={C.pink} />
                      <Text style={styles.smallActionText}>Mark all read</Text>
                    </Pressable>
                  ) : null}
                </View>

                {notifications.length === 0 ? (
                  <View style={[styles.emptyCard, { marginTop: 22 }]}>
                    <View style={styles.emptyIcon}>
                      <Ionicons
                        name="notifications-outline"
                        size={23}
                        color={C.pink}
                      />
                    </View>
                    <Text style={styles.emptyCardTitle}>No notifications yet</Text>
                    <Text style={styles.emptyCardDescription}>
                      Messages and replies from {partnerName} will show up here.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.notifList}>
                    {notifications.map((item, index) => (
                      <Pressable
                        key={item.id}
                        onPress={() => openNotification(item)}
                        style={[
                          styles.notifRow,
                          item.unread && styles.notifRowUnread,
                          index < notifications.length - 1 &&
                            styles.notifRowGap,
                        ]}
                      >
                        <View
                          style={[
                            styles.notifIcon,
                            {
                              backgroundColor:
                                item.kind === 'reply' ? C.blueSoft : C.pinkSoft,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              item.kind === 'reply'
                                ? 'return-up-back'
                                : 'mail'
                            }
                            size={18}
                            color={item.kind === 'reply' ? C.blue : C.pink}
                          />
                        </View>

                        <View style={styles.notifText}>
                          <Text style={styles.notifTitle} numberOfLines={1}>
                            {item.title}
                          </Text>

                          {item.quoted ? (
                            <Text style={styles.notifQuoted} numberOfLines={1}>
                              You: {item.quoted}
                            </Text>
                          ) : null}

                          <Text style={styles.notifBody} numberOfLines={2}>
                            {item.body}
                          </Text>

                          <Text style={styles.notifTime}>
                            {timeAgo(item.createdAt)} · Tap to reply
                          </Text>
                        </View>

                        {item.unread ? <View style={styles.unreadDot} /> : null}
                      </Pressable>
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={() => setNotifOpen(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* COMPOSE / REPLY MODAL */}
        <Modal
          visible={composeOpen}
          transparent
          animationType="slide"
          onRequestClose={closeCompose}
        >
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.modalBackdrop} onPress={closeCompose} />

            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScroll}
              >
                <Text style={styles.sheetTitle}>
                  {replyTo ? 'Reply' : 'Message'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {replyTo
                    ? `Replying to ${partnerName}`
                    : viewerMode
                      ? 'Send her something sweet.'
                      : 'Let him know how you feel.'}
                </Text>

                {replyTo ? (
                  <View style={styles.quoteBlock}>
                    <Text style={styles.quoteText} numberOfLines={3}>
                      {replyTo.body}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sheetLabel}>Quick messages</Text>
                    <View style={styles.chipWrap}>
                      {quickMessages.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => setComposeText(option)}
                          style={[
                            styles.chip,
                            composeText === option && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              composeText === option && styles.chipTextActive,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.sheetLabel}>
                  {replyTo ? 'Your reply' : 'Your message'}
                </Text>
                <TextInput
                  value={composeText}
                  onChangeText={(t) => setComposeText(t.slice(0, MESSAGE_MAX))}
                  placeholder={
                    replyTo ? 'Write a reply…' : 'Write your message…'
                  }
                  placeholderTextColor={C.faint}
                  multiline
                  textAlignVertical="top"
                  style={styles.messageInput}
                />
                <Text style={styles.charCount}>
                  {composeText.length}/{MESSAGE_MAX}
                </Text>

                <Pressable
                  onPress={sendMessage}
                  style={[
                    styles.primaryButton,
                    !composeText.trim() && styles.primaryButtonDisabled,
                  ]}
                  disabled={saving || !composeText.trim()}
                >
                  <Text style={styles.primaryButtonText}>
                    {replyTo ? 'Send reply' : 'Send message'}
                  </Text>
                </Pressable>

                <Pressable onPress={closeCompose} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {saving ? (
          <View style={styles.savingIndicator} pointerEvents="none">
            <ActivityIndicator size="small" color={C.pink} />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

/* COMPONENTS */

function SoftGradient({ stops }: { stops: GradientStop[] }) {
  const bands = useMemo(
    () => Array.from({ length: 44 }, (_, i) => colorAt(stops, i / 43)),
    [stops]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bands.map((color, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

function FeatureCard({
  title,
  subtitle,
  icon,
  color,
  background,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.featureCard, { backgroundColor: background }]}
      contentStyle={styles.featureCardContent}
    >
      <View style={[styles.featureIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={21} color="#FFFFFF" />
      </View>
      <View style={styles.featureCardBottom}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name="arrow-forward"
        size={17}
        color={C.muted}
        style={styles.featureArrow}
      />
    </PressScale>
  );
}

function RelationshipCard({
  title,
  subtitle,
  icon,
  background,
  color,
  badge = 0,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  background: string;
  color: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.relationshipCard, { backgroundColor: background }]}
      contentStyle={styles.relationshipCardContent}
    >
      <View style={[styles.relationshipIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={21} color="#FFFFFF" />
      </View>
      <Text style={styles.relationshipTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.relationshipSubtitle}>{subtitle}</Text>
      <View style={styles.relationshipArrow}>
        <Ionicons name="arrow-forward" size={16} color={color} />
      </View>
      {badge > 0 ? (
        <View style={[styles.cardBadge, { backgroundColor: color }]}>
          <Text style={styles.cardBadgeText}>
            {badge > 9 ? '9+' : badge} new
          </Text>
        </View>
      ) : null}
    </PressScale>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function TabItem({
  label,
  icon,
  active = false,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem} hitSlop={6}>
      <Ionicons
        name={icon}
        size={23}
        color={active ? color : C.muted}
      />
      <Text style={[styles.tabLabel, { color: active ? color : C.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },

  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: C.bg,
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 21,
    color: C.text,
    fontWeight: '500',
    textAlign: 'center',
  },

  emptyDescription: {
    marginTop: 8,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },

  primaryButton: {
    marginTop: 22,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: C.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonDisabled: {
    opacity: 0.45,
  },

  primaryButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTextGroup: {
    marginLeft: 8,
  },

  eyebrow: {
    fontSize: 9,
    letterSpacing: 2.2,
    fontWeight: '600',
  },

  headerTitle: {
    marginTop: 2,
    fontSize: 29,
    fontWeight: '300',
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },

  headerCalendar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  headerCalendarContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.pink,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellBadgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: '700',
  },

  dateStrip: {
    paddingTop: 22,
    paddingBottom: 8,
    gap: 9,
  },

  dateItem: {
    width: 43,
    alignItems: 'center',
  },

  dateWeekday: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 7,
  },

  dateCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateCirclePeriod: {
    backgroundColor: 'rgba(244,118,143,0.12)',
  },

  dateNumber: {
    fontSize: 14,
    color: C.text,
  },

  dateNumberActive: {
    color: C.white,
    fontWeight: '600',
  },

  dateDot: {
    marginTop: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  hero: {
    alignItems: 'center',
    paddingBottom: 4,
  },

  heroImageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  heroGlow: {
    position: 'absolute',
    width: '62%',
    aspectRatio: 1,
    borderRadius: 200,
    opacity: 0.07,
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  heroEyebrow: {
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 2.1,
    fontWeight: '500',
    opacity: 0.75,
    textAlign: 'center',
  },

  heroPhase: {
    marginTop: 8,
    fontSize: 39,
    fontWeight: '300',
    textAlign: 'center',
  },

  heroDay: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.85,
  },

  heroDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.85,
  },

  managePeriodButton: {
    marginTop: 17,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  managePeriodButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  managePeriodText: {
    fontSize: 12,
    fontWeight: '500',
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: C.text,
    letterSpacing: 0.1,
  },

  sectionHint: {
    fontSize: 11,
    color: C.muted,
  },

  todayCaption: {
    fontSize: 10,
    color: C.muted,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },

  featureScroller: {
    gap: 11,
    paddingRight: 20,
    paddingBottom: 4,
  },

  featureCard: {
    width: 158,
    minHeight: 145,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },

  featureCardContent: {
    flex: 1,
    padding: 14,
    minHeight: 145,
  },

  featureIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  featureCardBottom: {
    marginTop: 'auto',
    paddingTop: 12,
    paddingRight: 10,
  },

  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  featureSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
  },

  featureArrow: {
    position: 'absolute',
    right: 12,
    top: 15,
  },

  todayScroller: {
    gap: 12,
    paddingRight: 20,
    paddingBottom: 4,
  },

  relationshipCard: {
    width: 158,
    minHeight: 150,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },

  relationshipCardContent: {
    flex: 1,
    minHeight: 150,
    padding: 14,
  },

  relationshipIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  relationshipTitle: {
    marginTop: 13,
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },

  relationshipSubtitle: {
    marginTop: 5,
    paddingRight: 3,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
  },

  relationshipArrow: {
    position: 'absolute',
    top: 16,
    right: 14,
  },

  cardBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  cardBadgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: '700',
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },

  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 105,
    padding: 11,
    borderRadius: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  summaryLabel: {
    marginTop: 9,
    fontSize: 10,
    color: C.muted,
  },

  summaryValue: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: C.text,
  },

  emptyCard: {
    padding: 23,
    alignItems: 'center',
    borderRadius: 23,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },

  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCardTitle: {
    marginTop: 11,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },

  emptyCardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
    textAlign: 'center',
  },

  outlineButton: {
    marginTop: 15,
    borderRadius: 22,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.pinkBorder,
    backgroundColor: C.pinkSoft,
  },

  outlineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.pink,
  },

  smallAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: C.pinkSoft,
  },

  smallActionText: {
    color: C.pink,
    fontSize: 12,
    fontWeight: '600',
  },

  symptomList: {
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },

  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  symptomIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: C.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  symptomText: {
    flex: 1,
    marginLeft: 11,
  },

  symptomName: {
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
  },

  symptomDetail: {
    marginTop: 3,
    fontSize: 11,
    color: C.muted,
  },

  logsCard: {
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  logRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },

  logDateIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logText: {
    flex: 1,
    marginLeft: 11,
  },

  logTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },

  logSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: C.muted,
  },

  deleteButton: {
    padding: 7,
  },

  moreLogs: {
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  moreLogsText: {
    fontSize: 11,
    color: C.muted,
  },

  moreLogsLink: {
    fontSize: 12,
    fontWeight: '600',
    color: C.pink,
  },

  sharedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginTop: 24,
    marginBottom: 10,
    padding: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  sharedNoteText: {
    flex: 1,
  },

  sharedNoteTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
  },

  sharedNoteDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: C.muted,
  },

  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.95)',
    paddingTop: 10,
  },

  tabItem: {
    minWidth: 85,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabLabel: {
    marginTop: 3,
    fontSize: 10,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(25,25,35,0.3)',
  },

  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  sheetHandle: {
    alignSelf: 'center',
    marginTop: 10,
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D9D9DE',
  },

  sheetScroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 35,
  },

  sheetTitle: {
    fontSize: 24,
    color: C.text,
    fontWeight: '500',
  },

  sheetSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: C.muted,
  },

  sheetLabel: {
    marginTop: 20,
    marginBottom: 9,
    fontSize: 12,
    color: C.text,
    fontWeight: '600',
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
  },

  chipActive: {
    backgroundColor: C.pinkSoft,
    borderColor: C.pinkBorder,
  },

  chipText: {
    fontSize: 12,
    color: C.muted,
  },

  chipTextActive: {
    color: C.pink,
    fontWeight: '600',
  },

  loggedBlock: {
    marginTop: 18,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#FAF8FA',
  },

  loggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },

  loggedText: {
    flex: 1,
    marginRight: 10,
    fontSize: 12,
    color: C.text,
  },

  cancelButton: {
    height: 48,
    marginTop: 8,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    color: C.muted,
  },

  /* Notifications */

  notifHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  notifList: {
    marginTop: 18,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 13,
    borderRadius: 18,
    backgroundColor: '#FAF8FA',
    borderWidth: 1,
    borderColor: C.line,
  },

  notifRowUnread: {
    backgroundColor: '#FFF6F8',
    borderColor: C.pinkBorder,
  },

  notifRowGap: {
    marginBottom: 10,
  },

  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notifText: {
    flex: 1,
    marginLeft: 12,
  },

  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },

  notifQuoted: {
    marginTop: 4,
    fontSize: 11,
    color: C.faint,
    fontStyle: 'italic',
  },

  notifBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: C.text,
  },

  notifTime: {
    marginTop: 6,
    fontSize: 10,
    color: C.muted,
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.pink,
    marginLeft: 8,
    marginTop: 5,
  },

  /* Compose */

  quoteBlock: {
    marginTop: 18,
    padding: 13,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.pink,
    backgroundColor: '#FAF8FA',
  },

  quoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },

  messageInput: {
    minHeight: 110,
    maxHeight: 180,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    color: C.text,
  },

  charCount: {
    marginTop: 6,
    fontSize: 10,
    color: C.faint,
    textAlign: 'right',
  },

  savingIndicator: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 100,
    height: 44,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  savingText: {
    fontSize: 12,
    color: C.muted,
  },
});