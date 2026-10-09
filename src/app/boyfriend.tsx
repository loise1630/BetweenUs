import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  isDateInPeriod,
  parseDate,
  PeriodDashboard,
  PeriodLog,
  PeriodSettings,
  savePeriodSymptom,
  SymptomSeverity,
  updatePeriod,
} from '../lib/period';

import { getAccountState } from '../lib/account';
import { FadeIn, IconButton, PressScale, Screen } from '../lib/ui';

/* ============================================================
   PHASE IMAGES  (file is in src/app/, so ../../assets/ = project root)
   ============================================================ */

const PHASE_IMAGES: Record<CyclePhase, any> = {
  Period: require('../../assets/images/menstrual.png'),
  Follicular: require('../../assets/images/follicular-phase.png'),
  Ovulation: require('../../assets/images/ovulation-phase.png'),
  Luteal: require('../../assets/images/luteal-phase.png'),
};

/* ============================================================
   ROUTES
   ============================================================ */

const ROUTES = {
  want: '/want',
  unsaid: '/unsaid',
  littleThings: '/little-things',
  insights: '/insights',
};

/* ============================================================
   COLORS
   ============================================================ */

const BG = '#FBF7F7';
const CARD = '#FFFFFF';
const TEXT = '#20273A';
const MUTED = '#7C8294';
const FAINT = '#A8ADBB';

const PINK = '#F4768F';
const PINK_SOFT = '#FDE7EC';
const PINK_BORDER = '#F7D8DF';

const PURPLE = '#A58BE0';
const PURPLE_SOFT = '#F0EBFB';

const BLUE = '#7099E8';
const BLUE_SOFT = '#EAF0FC';

const PEACH = '#F29A82';
const PEACH_SOFT = '#FDECE7';

const GOLD = '#E3A93F';
const GOLD_SOFT = '#FCF3DD';

const GREEN = '#70B58E';

const LINE = '#F0E3E6';

/* ============================================================
   PHASE COPY
   ============================================================ */

const PHASE_COPY: Record<
  CyclePhase,
  {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    line1: string;
    line2: string;
    partnerLine1: string;
    partnerLine2: string;
  }
> = {
  Period: {
    title: 'Menstruation',
    icon: 'water',
    accent: PINK,
    line1: 'Your body is renewing.',
    line2: 'Take it easy today.',
    partnerLine1: 'She may need extra care.',
    partnerLine2: 'Be gentle and patient today.',
  },
  Follicular: {
    title: 'Follicular',
    icon: 'leaf',
    accent: GREEN,
    line1: 'Your energy is building.',
    line2: 'A fresh start is here.',
    partnerLine1: 'Her energy is building.',
    partnerLine2: 'A good time for something fun.',
  },
  Ovulation: {
    title: 'Ovulation',
    icon: 'flower',
    accent: PEACH,
    line1: 'You may feel more energetic.',
    line2: 'Enjoy the extra energy.',
    partnerLine1: 'She may feel more energetic.',
    partnerLine2: 'Plan something special together.',
  },
  Luteal: {
    title: 'Luteal',
    icon: 'moon',
    accent: PURPLE,
    line1: 'Time to slow down.',
    line2: 'Be gentle with yourself.',
    partnerLine1: 'She may feel more tired.',
    partnerLine2: 'Small kindnesses can go a long way.',
  },
};

/* ============================================================
   OPTIONS
   ============================================================ */

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

/* how many period logs are visible before "Show older" */
const LOGS_PREVIEW_COUNT = 5;

type SheetName = 'calendar' | 'symptoms' | 'logs' | null;

/* ============================================================
   HELPERS
   ============================================================ */

function todayString() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatReadableDate(value: string | null) {
  if (!value) return 'Not enough data';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function capitalize(value: string) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let day = 1; day <= totalDays; day++) days.push(day);
  while (days.length % 7 !== 0) days.push(null);

  return days;
}

function formatCalendarDate(month: Date, day: number) {
  const year = month.getFullYear();
  const monthNumber = String(month.getMonth() + 1).padStart(2, '0');
  const dayNumber = String(day).padStart(2, '0');
  return `${year}-${monthNumber}-${dayNumber}`;
}

function groupByYear(list: PeriodLog[]): [string, PeriodLog[]][] {
  const map = new Map<string, PeriodLog[]>();

  list.forEach((period) => {
    const year = period.start_date.slice(0, 4);
    map.set(year, [...(map.get(year) || []), period]);
  });

  return Array.from(map.entries());
}

type Role = 'girlfriend' | 'boyfriend' | 'unknown';

function detectRole(account: any): Role {
  if (!account) return 'unknown';

  if (account.is_girlfriend === true || account.isGirlfriend === true) {
    return 'girlfriend';
  }
  if (account.is_boyfriend === true || account.isBoyfriend === true) {
    return 'boyfriend';
  }

  const values = [
    account.role,
    account.user_role,
    account.relationship_role,
    account.partner_role,
    account.account_role,
    account.account_type,
  ]
    .filter((value) => typeof value === 'string')
    .map((value: string) => value.toLowerCase().trim());

  if (values.some((v) => v === 'girlfriend' || v === 'girl' || v === 'female')) {
    return 'girlfriend';
  }
  if (values.some((v) => v === 'boyfriend' || v === 'boy' || v === 'male')) {
    return 'boyfriend';
  }

  return 'unknown';
}

function partnerHasData(data: PeriodDashboard | null) {
  if (!data?.partner) return false;

  return (
    (data.partner.periods?.length || 0) > 0 ||
    !!data.partner.settings?.latest_period_start
  );
}

const FALLBACK_SETTINGS: PeriodSettings = {
  tracking_enabled: true,
  average_cycle_length: 28,
  average_period_length: 5,
};

/* ============================================================
   SCREEN
   ============================================================ */

export default function PeriodScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [dashboard, setDashboard] = useState<PeriodDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [viewerMode, setViewerMode] = useState(false);
  const [ready, setReady] = useState(false);

  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [sheet, setSheet] = useState<SheetName>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const [symptomType, setSymptomType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [mood, setMood] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  /* ---------- load ---------- */

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

  /* ---------- boot ---------- */

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function boot() {
        try {
          const account: any = await getAccountState();
          let role = detectRole(account);
          let preloaded: PeriodDashboard | null = null;

          /*
           * If the account has no role info, decide using the data:
           * no own periods + partner has shared data = boyfriend/viewer.
           */
          if (role === 'unknown') {
            preloaded = await getPeriodDashboard();

            role =
              partnerHasData(preloaded) && preloaded.own.periods.length === 0
                ? 'boyfriend'
                : 'girlfriend';
          }

          const isBoyfriend = role === 'boyfriend';

          if (!mounted) return;

          setViewerMode(isBoyfriend);

          /* Girlfriend must finish setup first. Boyfriend never does. */
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

          setReady(true);

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
            await loadDashboard();
          }
        }
      }

      boot();

      return () => {
        mounted = false;
      };
    }, [loadDashboard])
  );

  /* ---------- derived data ---------- */

  const ownPeriods = dashboard?.own?.periods || [];
  const ownSymptoms = dashboard?.own?.symptoms || [];
  const ownSettings = dashboard?.own?.settings || null;

  const partnerData = dashboard?.partner || null;
  const partnerSettings = partnerData?.settings || null;
  const partnerPeriodsRaw = partnerData?.periods || [];
  const partnerSymptoms = partnerData?.symptoms || [];
  const partnerLatestStart = partnerSettings?.latest_period_start ?? null;

  /*
   * Boyfriend always sees everything she logs.
   * If only the latest start date is available, use that.
   */
  const sharedPeriods: PeriodLog[] =
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

  const periods: PeriodLog[] = viewerMode ? sharedPeriods : ownPeriods;
  const symptoms = viewerMode ? partnerSymptoms : ownSymptoms;

  const baseSettings: PeriodSettings = ownSettings || FALLBACK_SETTINGS;

  const settings: PeriodSettings = viewerMode
    ? {
        ...baseSettings,
        average_cycle_length:
          partnerSettings?.average_cycle_length ||
          baseSettings.average_cycle_length ||
          28,
        average_period_length:
          partnerSettings?.average_period_length ||
          baseSettings.average_period_length ||
          5,
      }
    : baseSettings;

  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);

  const sortedPeriods = [...periods].sort((a, b) =>
    b.start_date.localeCompare(a.start_date)
  );

  const latestPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;

  const hasCycleData = periods.length > 0;
  const cycleLength = settings.average_cycle_length || 28;
  const periodLength = settings.average_period_length || 5;

  const cycleInfo = getCurrentCycleInfo(periods, settings);

  const today = todayString();

  /* strip: start at latest period while early in the cycle, else today */
  const stripStart =
    latestPeriod && cycleInfo.cycleDay && cycleInfo.cycleDay <= 10
      ? latestPeriod.start_date
      : today;

  const stripDates: string[] = Array.from({ length: 10 }, (_, index) =>
    addDays(stripStart, index)
  );

  const activeDate =
    selectedDate && stripDates.includes(selectedDate)
      ? selectedDate
      : stripDates.includes(today)
      ? today
      : stripDates[0];

  const activeInfo = getCycleInfoForDate(periods, settings, activeDate);

  const activePhase: CyclePhase = activeInfo.phase || 'Period';
  const activeCopy = PHASE_COPY[activePhase];
  const phaseImage = PHASE_IMAGES[hasCycleData ? activePhase : 'Period'];

  const predictedNext =
    viewerMode && partnerSettings?.predicted_next_period
      ? partnerSettings.predicted_next_period
      : getPredictedNextPeriod(periods, cycleLength);

  const todaySymptoms = getTodaySymptoms(symptoms);

  const loggedPeriodLength = latestPeriod
    ? calculatePeriodLength(latestPeriod)
    : null;

  const displayPeriodLength = loggedPeriodLength || periodLength;

  /* own period state (girlfriend actions) */

  const latestOwn =
    ownPeriods.length > 0
      ? [...ownPeriods].sort((a, b) =>
          b.start_date.localeCompare(a.start_date)
        )[0]
      : null;

  const canEndPeriod =
    !viewerMode &&
    !!latestOwn &&
    !latestOwn.end_date &&
    latestOwn.start_date <= today;

  const startedToday = ownPeriods.some((p) => p.start_date === today);

  /* logs list */

  const visibleLogs = showAllLogs
    ? sortedPeriods
    : sortedPeriods.slice(0, LOGS_PREVIEW_COUNT);

  const hiddenLogsCount = sortedPeriods.length - visibleLogs.length;

  /* hero sizing */

  const circleSize = Math.min(width * 0.72, 340);
  const ringSize = circleSize + 36;
  const ringRadius = ringSize / 2;

  const progress = activeInfo.cycleDay
    ? Math.min(activeInfo.cycleDay / cycleLength, 1)
    : 0;

  const headAngle = progress * Math.PI * 2;
  const arcDots = Math.floor(progress * 60);

  const heroLine1 = viewerMode ? activeCopy.partnerLine1 : activeCopy.line1;
  const heroLine2 = viewerMode ? activeCopy.partnerLine2 : activeCopy.line2;

  /* ============================================================
     ACTIONS  (girlfriend only)
     ============================================================ */

  async function refresh() {
    await loadDashboard();
  }

  function closeSheet() {
    setSheet(null);
    setShowAllLogs(false);
  }

  async function startPeriodToday() {
    if (viewerMode) return;

    if (startedToday) {
      Alert.alert('Already logged', 'Today is already saved as a period start.');
      return;
    }

    try {
      setSaving(true);
      await createPeriod(today, null, '');
      await refresh();
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function endPeriodToday() {
    if (viewerMode || !latestOwn || latestOwn.end_date) return;

    try {
      setSaving(true);
      await updatePeriod(
        latestOwn.id,
        latestOwn.start_date,
        today,
        latestOwn.notes || ''
      );
      await refresh();
    } catch (error: any) {
      Alert.alert('Could not update', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
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

  function openRoute(route: string) {
    try {
      router.push(route as any);
    } catch (error) {
      console.error('PERIOD ROUTE:', error);
    }
  }

  /* ============================================================
     LOADING / ERROR
     ============================================================ */

  if (!ready || loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={PINK} size="small" />
        </View>
      </Screen>
    );
  }

  if (!dashboard) {
    return (
      <Screen>
        <View style={styles.emptyScreen}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={28} color={PINK} />
          </View>

          <Text style={styles.emptyScreenTitle}>
            {viewerMode ? 'Her cycle' : 'Your cycle'}
          </Text>

          <Text style={styles.emptyScreenText}>
            Something went wrong while loading. Please check your connection and
            try again.
          </Text>

          <Pressable onPress={refresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <Screen>
      <View style={styles.root}>
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
            <View style={styles.headerLeft}>
              {router.canGoBack?.() ? (
                <View style={styles.backWrap}>
                  <IconButton name="arrow-back" onPress={() => router.back()} />
                </View>
              ) : null}

              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle}>
                    {viewerMode ? 'Her cycle' : 'Your cycle'}
                  </Text>
                  <Ionicons
                    name="heart"
                    size={17}
                    color={PINK}
                    style={{ marginLeft: 8 }}
                  />
                </View>

                <Text style={styles.headerSubtitle}>
                  {viewerMode
                    ? 'Shared with you, with love.'
                    : 'Small steps, big care.'}
                </Text>
              </View>
            </View>
          </FadeIn>

          {/* DATE STRIP */}
          <FadeIn delay={50} style={styles.strip}>
            {stripDates.map((date) => {
              const active = date === activeDate;
              const info = getCycleInfoForDate(periods, settings, date);

              const number =
                hasCycleData && info.cycleDay
                  ? String(info.cycleDay)
                  : String(parseDate(date).getDate());

              const weekday = parseDate(date).toLocaleDateString(undefined, {
                weekday: 'short',
              });

              return (
                <Pressable
                  key={date}
                  onPress={() => setSelectedDate(date)}
                  style={styles.stripItem}
                >
                  <View
                    style={[styles.stripPill, active && styles.stripPillActive]}
                  >
                    <Text
                      style={[
                        styles.stripNumber,
                        active && styles.stripTextActive,
                      ]}
                    >
                      {number}
                    </Text>
                    <Text
                      style={[
                        styles.stripWeekday,
                        active && styles.stripTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {weekday}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </FadeIn>

          {/* HERO */}
          <FadeIn delay={90}>
            <View
              style={[styles.heroWrap, { width: ringSize, height: ringSize }]}
            >
              <View
                style={[
                  styles.ring,
                  {
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringRadius,
                  },
                ]}
              />

              {Array.from({ length: arcDots }, (_, index) => {
                const angle = (index / 60) * Math.PI * 2;
                return (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.arcDot,
                      {
                        backgroundColor: activeCopy.accent,
                        left: ringRadius + ringRadius * Math.sin(angle) - 1.5,
                        top: ringRadius - ringRadius * Math.cos(angle) - 1.5,
                      },
                    ]}
                  />
                );
              })}

              {hasCycleData ? (
                <View
                  style={[
                    styles.headDot,
                    {
                      backgroundColor: activeCopy.accent,
                      left: ringRadius + ringRadius * Math.sin(headAngle) - 7,
                      top: ringRadius - ringRadius * Math.cos(headAngle) - 7,
                    },
                  ]}
                />
              ) : null}

              <View
                style={[
                  styles.circleShadow,
                  {
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                  },
                ]}
              >
                <View
                  style={[styles.circleClip, { borderRadius: circleSize / 2 }]}
                >
                  <Image
                    source={phaseImage}
                    style={styles.circleImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>

            {/* Phase text lives in the blank space below the circle */}
            <View style={styles.heroTextBlock}>
              <View
                style={[
                  styles.heroIconHalo,
                  { backgroundColor: `${activeCopy.accent}26` },
                ]}
              >
                <View
                  style={[
                    styles.heroIcon,
                    { backgroundColor: activeCopy.accent },
                  ]}
                >
                  <Ionicons
                    name={hasCycleData ? activeCopy.icon : 'water'}
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.heroLabel, { color: activeCopy.accent }]}>
                {viewerMode ? 'SHARED CYCLE PHASE' : 'MENSTRUAL CYCLE PHASE'}
              </Text>

              <Text
                style={styles.heroTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {hasCycleData ? activeCopy.title : 'No cycle yet'}
              </Text>

              <Text style={styles.heroDay}>
                {hasCycleData && activeInfo.cycleDay
                  ? `Day ${activeInfo.cycleDay} of ${cycleLength}`
                  : hasCycleData
                  ? 'Upcoming cycle'
                  : 'Nothing logged yet'}
              </Text>

              <Text style={styles.heroDescription}>
                {hasCycleData
                  ? `${heroLine1}\n${heroLine2}`
                  : viewerMode
                  ? 'Once she logs her period,\nit will show up here.'
                  : 'Log your first period to begin.'}
              </Text>
            </View>
          </FadeIn>

          {/* QUICK ACCESS  (swipe sideways) */}
          <FadeIn delay={140}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickScroll}
              contentContainerStyle={styles.quickContent}
            >
              <FeatureTile
                width={128}
                icon="calendar"
                iconColor={PEACH}
                background={PEACH_SOFT}
                border="#F7DAD2"
                title="Calendar"
                description="Cycle dates and predictions."
                onPress={() => setSheet('calendar')}
              />
              <FeatureTile
                width={128}
                icon="happy"
                iconColor={PURPLE}
                background={PURPLE_SOFT}
                border="#E1D9F5"
                title="Symptoms"
                description={
                  viewerMode ? "How she's feeling." : 'Track how you feel.'
                }
                onPress={() => setSheet('symptoms')}
              />
              <FeatureTile
                width={128}
                icon="water"
                iconColor={PINK}
                background={PINK_SOFT}
                border={PINK_BORDER}
                title="Period Logs"
                description={
                  viewerMode ? 'Her period history.' : 'Your period history.'
                }
                onPress={() => setSheet('logs')}
              />
              <FeatureTile
                width={128}
                icon="bar-chart"
                iconColor={BLUE}
                background={BLUE_SOFT}
                border="#D8E2F5"
                title="Insights"
                description="Patterns and trends."
                onPress={() => openRoute(ROUTES.insights)}
              />
            </ScrollView>
          </FadeIn>

          {/* TODAY */}
          <FadeIn delay={190}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTitle}>Today</Text>
              <View style={styles.todayDot} />
              <Text style={styles.todayUpdates}>
                {todaySymptoms.length > 0
                  ? `${viewerMode ? 'She has' : 'You have'} ${
                      todaySymptoms.length
                    } update${todaySymptoms.length === 1 ? '' : 's'}`
                  : 'Nothing new yet'}
              </Text>
            </View>

            <View style={styles.todayRow}>
              <PressScale
                onPress={() => setSheet('logs')}
                scaleTo={0.97}
                style={styles.todayCard}
                contentStyle={styles.todayCardContent}
              >
                <View style={[styles.todayIcon, { backgroundColor: PINK }]}>
                  <Ionicons name="water-outline" size={17} color="#FFFFFF" />
                </View>
                <View style={styles.todayText}>
                  <Text style={styles.todayCardTitle} numberOfLines={1}>
                    Period
                  </Text>
                  <Text style={styles.todayCardSub} numberOfLines={1}>
                    {hasCycleData && cycleInfo.cycleDay
                      ? `Day ${cycleInfo.cycleDay} • ${displayPeriodLength} days`
                      : 'No period data'}
                  </Text>
                </View>
              </PressScale>

              <PressScale
                onPress={() => setSheet('symptoms')}
                scaleTo={0.97}
                style={styles.todayCardPurple}
                contentStyle={styles.todayCardContent}
              >
                <View style={[styles.todayIcon, { backgroundColor: PURPLE }]}>
                  <Ionicons name="happy-outline" size={17} color="#FFFFFF" />
                </View>
                <View style={styles.todayText}>
                  <Text style={styles.todayCardTitle} numberOfLines={1}>
                    Symptoms
                  </Text>
                  <Text style={styles.todayCardSub} numberOfLines={1}>
                    {todaySymptoms.length > 0
                      ? todaySymptoms.map((i) => i.symptom_type).join(', ')
                      : viewerMode
                      ? 'Nothing shared today'
                      : 'Track how you feel'}
                  </Text>
                </View>
              </PressScale>
            </View>

            <View style={styles.infoRow}>
              <InfoCard
                icon="calendar-outline"
                label="Next expected"
                value={formatReadableDate(predictedNext)}
              />
              <InfoCard
                icon="repeat-outline"
                label="Cycle length"
                value={`${cycleLength} days`}
              />
              <InfoCard
                icon="water-outline"
                label="Period length"
                value={`${periodLength} days`}
              />
            </View>
          </FadeIn>

          {/* WANT / UNSAID / LITTLE THINGS */}
          <FadeIn delay={240}>
            <View style={styles.tileRow}>
              <FeatureTile
                icon="heart"
                iconColor={PINK}
                background={PINK_SOFT}
                border={PINK_BORDER}
                title="Want"
                description={
                  viewerMode
                    ? "See what she'd love."
                    : "Tell him what you'd love."
                }
                onPress={() => openRoute(ROUTES.want)}
              />
              <FeatureTile
                icon="chatbubble-ellipses"
                iconColor={PURPLE}
                background={PURPLE_SOFT}
                border="#E1D9F5"
                title="Unsaid"
                description={
                  viewerMode
                    ? "Things she can't say directly."
                    : "Things you can't say directly."
                }
                onPress={() => openRoute(ROUTES.unsaid)}
              />
              <FeatureTile
                icon="star"
                iconColor={GOLD}
                background={GOLD_SOFT}
                border="#F3E2B8"
                title="Little Things"
                description="Small moments that matter."
                onPress={() => openRoute(ROUTES.littleThings)}
              />
            </View>
          </FadeIn>

          {/* SHARING NOTE (girlfriend only, no toggle) */}
          {!viewerMode ? (
            <FadeIn delay={290}>
              <View style={[styles.card, styles.noteCard]}>
                <View style={styles.noteIcon}>
                  <Ionicons name="heart-outline" size={20} color={PINK} />
                </View>
                <View style={styles.noteText}>
                  <Text style={styles.noteTitle}>Shared with your partner</Text>
                  <Text style={styles.noteDescription}>
                    Your cycle, symptoms and history are visible to your partner
                    so he can take care of you better.
                  </Text>
                </View>
              </View>
            </FadeIn>
          ) : null}
        </ScrollView>

        {/* BOTTOM NAV */}
        <View
          style={[
            styles.tabBar,
            { paddingBottom: Math.max(insets.bottom, 14) + 4 },
          ]}
        >
          <TabItem
            label="Home"
            icon="home-outline"
            activeIcon="home"
            active
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
          <TabItem
            label="Calendar"
            icon="calendar-outline"
            activeIcon="calendar"
            onPress={() => setSheet('calendar')}
          />
          <TabItem
            label="Insights"
            icon="bar-chart-outline"
            activeIcon="bar-chart"
            onPress={() => openRoute(ROUTES.insights)}
          />
        </View>

        {/* ======================================================
            CALENDAR SHEET
            ====================================================== */}
        <Sheet
          visible={sheet === 'calendar'}
          title="Calendar"
          subtitle={viewerMode ? 'Her cycle at a glance' : 'Your cycle at a glance'}
          bottomInset={insets.bottom}
          onClose={closeSheet}
        >
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              style={styles.arrowButton}
            >
              <Ionicons name="chevron-back" size={18} color={TEXT} />
            </Pressable>

            <Text style={styles.monthTitle}>{getMonthTitle(month)}</Text>

            <Pressable
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              style={styles.arrowButton}
            >
              <Ionicons name="chevron-forward" size={18} color={TEXT} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const dateString = formatCalendarDate(month, day);
              const isPeriod = periods.some((period) =>
                isDateInPeriod(dateString, period, periodLength)
              );
              const isToday = dateString === today;

              return (
                <View key={dateString} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayCircle,
                      isPeriod && styles.periodDay,
                      isToday && styles.todayDay,
                    ]}
                  >
                    <Text
                      style={[styles.dayText, isPeriod && styles.periodDayText]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.periodLegend]} />
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.todayLegend]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
          </View>
        </Sheet>

        {/* ======================================================
            SYMPTOMS SHEET  (girlfriend edits, boyfriend views)
            ====================================================== */}
        <Sheet
          visible={sheet === 'symptoms'}
          title="Symptoms"
          subtitle={
            viewerMode ? 'What she logged today' : 'How are you feeling today?'
          }
          busy={saving}
          bottomInset={insets.bottom}
          onClose={closeSheet}
        >
          {viewerMode ? (
            todaySymptoms.length > 0 ? (
              <View style={[styles.card, styles.listCard]}>
                {todaySymptoms.map((item, index) => (
                  <View
                    key={item.id || `${item.symptom_type}-${index}`}
                    style={[
                      styles.symptomRow,
                      index < todaySymptoms.length - 1 && styles.symptomBorder,
                    ]}
                  >
                    <View style={styles.symptomDot} />
                    <Text style={styles.symptomName}>{item.symptom_type}</Text>
                    <Text style={styles.symptomMeta}>
                      {capitalize(item.severity) || 'Logged'}
                      {item.mood ? ` • ${item.mood}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.card, styles.emptyCard]}>
                <Ionicons name="happy-outline" size={25} color={FAINT} />
                <Text style={styles.emptyTitle}>Nothing shared today</Text>
                <Text style={styles.emptyText}>
                  When she logs how she feels, it will show up here.
                </Text>
              </View>
            )
          ) : (
            <>
              {todaySymptoms.length > 0 ? (
                <View style={styles.loggedBlock}>
                  <Text style={[styles.sheetLabel, { marginTop: 0 }]}>
                    Logged today
                  </Text>

                  {todaySymptoms.map((item) => (
                    <View key={item.id} style={styles.loggedRow}>
                      <Text style={styles.loggedText}>
                        {item.symptom_type} • {capitalize(item.severity)}
                        {item.mood ? ` • ${item.mood}` : ''}
                      </Text>

                      <Pressable
                        onPress={() => removeSymptom(item.id)}
                        hitSlop={10}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={20}
                          color={FAINT}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.sheetLabel}>Symptom</Text>
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
                    onPress={() => setMood(mood === option ? null : option)}
                    style={[styles.chip, mood === option && styles.chipActive]}
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

              <Pressable onPress={saveSymptom} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save symptom</Text>
              </Pressable>
            </>
          )}
        </Sheet>

        {/* ======================================================
            PERIOD LOGS SHEET
            ====================================================== */}
        <Sheet
          visible={sheet === 'logs'}
          title="Period logs"
          subtitle={
            sortedPeriods.length > 0
              ? `${sortedPeriods.length} logged • avg ${periodLength} days`
              : viewerMode
              ? 'Her period history'
              : 'Your period history'
          }
          busy={saving}
          bottomInset={insets.bottom}
          onClose={closeSheet}
        >
          {!viewerMode ? (
            <View style={styles.logActions}>
              {canEndPeriod ? (
                <Pressable
                  onPress={endPeriodToday}
                  style={[styles.logButton, styles.logButtonGhost]}
                >
                  <Ionicons name="stop-circle-outline" size={17} color={PINK} />
                  <Text style={styles.logButtonGhostText}>End today</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={startPeriodToday}
                disabled={startedToday}
                style={[
                  styles.logButton,
                  styles.logButtonPrimary,
                  startedToday && styles.logButtonDisabled,
                ]}
              >
                <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
                <Text style={styles.logButtonPrimaryText}>
                  {startedToday ? 'Started today' : 'Start today'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {sortedPeriods.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Ionicons name="calendar-clear-outline" size={25} color={FAINT} />
              <Text style={styles.emptyTitle}>No periods logged yet</Text>
              <Text style={styles.emptyText}>
                {viewerMode
                  ? 'Her period history will appear here once she starts tracking.'
                  : 'Your period history will appear here once you start tracking.'}
              </Text>
            </View>
          ) : (
            <>
              {groupByYear(visibleLogs).map(([year, items]) => (
                <View key={year}>
                  <Text style={styles.yearLabel}>{year}</Text>

                  <View style={[styles.card, styles.listCard]}>
                    {items.map((period, index) => {
                      const isLatest = latestPeriod?.id === period.id;
                      const length = calculatePeriodLength(period);

                      const range = period.end_date
                        ? `${formatShortDate(period.start_date)} – ${formatShortDate(
                            period.end_date
                          )}`
                        : `${formatShortDate(period.start_date)} –`;

                      const sub = period.end_date
                        ? length
                          ? `${length} day${length === 1 ? '' : 's'}`
                          : ''
                        : isLatest
                        ? 'Ongoing'
                        : 'No end date';

                      return (
                        <View
                          key={period.id}
                          style={[
                            styles.logRow,
                            index < items.length - 1 && styles.logRowBorder,
                          ]}
                        >
                          <View
                            style={[
                              styles.logDot,
                              isLatest && styles.logDotLatest,
                            ]}
                          />

                          <View style={styles.logText}>
                            <Text style={styles.logRange}>{range}</Text>
                            {sub ? (
                              <Text style={styles.logSub}>{sub}</Text>
                            ) : null}
                          </View>

                          {isLatest ? (
                            <View style={styles.latestBadge}>
                              <Text style={styles.latestBadgeText}>Latest</Text>
                            </View>
                          ) : null}

                          {!viewerMode && period.id !== 'shared-summary' ? (
                            <Pressable
                              onPress={() => deleteOwnPeriod(period)}
                              hitSlop={10}
                              style={styles.logDelete}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={17}
                                color={FAINT}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

              {hiddenLogsCount > 0 ? (
                <Pressable
                  onPress={() => setShowAllLogs(true)}
                  style={styles.showMore}
                >
                  <Text style={styles.showMoreText}>
                    Show {hiddenLogsCount} older
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={PINK} />
                </Pressable>
              ) : showAllLogs && sortedPeriods.length > LOGS_PREVIEW_COUNT ? (
                <Pressable
                  onPress={() => setShowAllLogs(false)}
                  style={styles.showMore}
                >
                  <Text style={styles.showMoreText}>Show less</Text>
                  <Ionicons name="chevron-up" size={16} color={PINK} />
                </Pressable>
              ) : null}
            </>
          )}
        </Sheet>
      </View>
    </Screen>
  );
}

/* ============================================================
   COMPONENTS
   ============================================================ */

function Sheet({
  visible,
  title,
  subtitle,
  busy,
  bottomInset,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  busy?: boolean;
  bottomInset: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.sheetSubtitle}>{subtitle}</Text>
              ) : null}
            </View>

            {busy ? (
              <ActivityIndicator
                size="small"
                color={PINK}
                style={styles.sheetBusy}
              />
            ) : null}

            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
              <Ionicons name="close" size={18} color={TEXT} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.sheetScroll,
              { paddingBottom: 28 + bottomInset },
            ]}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FeatureTile({
  icon,
  iconColor,
  background,
  border,
  title,
  description,
  width,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  background: string;
  border: string;
  title: string;
  description: string;
  width?: number;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.tile,
        width ? { flex: 0, width } : null,
        { backgroundColor: background, borderColor: border },
      ])}
      contentStyle={styles.tileContent}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: iconColor }]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
        <Ionicons name="chevron-forward" size={14} color={MUTED} />
      </View>

      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>

      <Text style={styles.tileDescription} numberOfLines={3}>
        {description}
      </Text>
    </PressScale>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.card, styles.infoCard]}>
      <Ionicons name={icon} size={18} color={PINK} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function TabItem({
  label,
  icon,
  activeIcon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem} hitSlop={6}>
      <Ionicons
        name={active ? activeIcon : icon}
        size={26}
        color={active ? PINK : MUTED}
      />
      <Text style={[styles.tabLabel, { color: active ? PINK : MUTED }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },

  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: BG,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: PINK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyScreenTitle: {
    marginTop: 18,
    fontSize: 22,
    color: TEXT,
    fontWeight: '500',
  },

  emptyScreenText: {
    marginTop: 8,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 21,
  },

  retryButton: {
    marginTop: 20,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: PINK,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  backWrap: {
    marginRight: 10,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: '500',
    color: TEXT,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    color: MUTED,
  },

  /* STRIP */

  strip: {
    flexDirection: 'row',
    marginTop: 18,
    marginHorizontal: -6,
  },

  stripItem: {
    flex: 1,
    alignItems: 'center',
  },

  stripPill: {
    width: '94%',
    minHeight: 62,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },

  stripPillActive: {
    backgroundColor: '#FCDDE2',
  },

  stripNumber: {
    fontSize: 16,
    color: TEXT,
  },

  stripWeekday: {
    marginTop: 5,
    fontSize: 11,
    color: MUTED,
  },

  stripTextActive: {
    color: '#E5484D',
    fontWeight: '600',
  },

  /* HERO */

  heroWrap: {
    alignSelf: 'center',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(244,118,143,0.12)',
  },

  arcDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.5,
  },

  headDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  circleShadow: {
    backgroundColor: '#FBE9ED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },

  circleClip: {
    flex: 1,
    overflow: 'hidden',
  },

  circleImage: {
    width: '100%',
    height: '100%',
  },

  heroTextBlock: {
    alignItems: 'center',
    marginTop: -30,
    paddingHorizontal: 24,
  },

  heroIconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: BG,
  },

  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroLabel: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.2,
    textAlign: 'center',
  },

  heroTitle: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: '500',
    color: TEXT,
    textAlign: 'center',
  },

  heroDay: {
    marginTop: 6,
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
  },

  heroDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    textAlign: 'center',
  },

  /* QUICK ACCESS ROW */

  quickScroll: {
    marginTop: 22,
    marginHorizontal: -20,
    flexGrow: 0,
  },

  quickContent: {
    paddingHorizontal: 20,
    gap: 10,
  },

  /* TILES */

  tileRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
  },

  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
  },

  tileContent: {
    padding: 10,
    minHeight: 126,
  },

  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tileTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT,
  },

  tileDescription: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: MUTED,
  },

  /* TODAY */

  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },

  todayTitle: {
    fontSize: 20,
    color: TEXT,
    fontWeight: '400',
  },

  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 12,
    backgroundColor: PINK,
  },

  todayUpdates: {
    marginLeft: 7,
    fontSize: 11,
    color: MUTED,
  },

  todayRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  todayCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FDEDF0',
    borderWidth: 1,
    borderColor: PINK_BORDER,
  },

  todayCardPurple: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: PURPLE_SOFT,
    borderWidth: 1,
    borderColor: '#E1D9F5',
  },

  todayCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  todayIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  todayText: {
    flex: 1,
    marginLeft: 10,
  },

  todayCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT,
  },

  todayCardSub: {
    marginTop: 3,
    fontSize: 10,
    color: MUTED,
  },

  /* INFO */

  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  infoCard: {
    flex: 1,
    padding: 13,
    minHeight: 98,
  },

  infoLabel: {
    marginTop: 9,
    fontSize: 10,
    color: MUTED,
  },

  infoValue: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT,
    fontWeight: '500',
  },

  /* CALENDAR (inside sheet) */

  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PINK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthTitle: {
    fontSize: 15,
    color: TEXT,
    fontWeight: '500',
  },

  weekRow: {
    flexDirection: 'row',
    marginTop: 16,
  },

  weekText: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    color: FAINT,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },

  dayCell: {
    width: '14.285%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    fontSize: 12,
    color: TEXT,
  },

  periodDay: {
    backgroundColor: PINK,
  },

  periodDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  todayDay: {
    borderWidth: 1.5,
    borderColor: BLUE,
  },

  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  periodLegend: {
    backgroundColor: PINK,
  },

  todayLegend: {
    borderWidth: 1.5,
    borderColor: BLUE,
  },

  legendText: {
    fontSize: 10,
    color: MUTED,
  },

  /* EMPTY / LIST CARDS */

  emptyCard: {
    alignItems: 'center',
    padding: 26,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    color: TEXT,
    fontWeight: '500',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },

  listCard: {
    paddingHorizontal: 14,
  },

  /* SYMPTOM LIST (viewer) */

  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  symptomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  symptomDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PURPLE,
    marginRight: 10,
  },

  symptomName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT,
  },

  symptomMeta: {
    fontSize: 11,
    color: MUTED,
  },

  /* PERIOD LOGS */

  logActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },

  logButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  logButtonPrimary: {
    backgroundColor: PINK,
  },

  logButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  logButtonGhost: {
    backgroundColor: PINK_SOFT,
    borderWidth: 1,
    borderColor: PINK_BORDER,
  },

  logButtonGhostText: {
    color: PINK,
    fontSize: 13,
    fontWeight: '600',
  },

  logButtonDisabled: {
    opacity: 0.45,
  },

  yearLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.5,
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  logRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK_BORDER,
    marginRight: 12,
  },

  logDotLatest: {
    backgroundColor: PINK,
  },

  logText: {
    flex: 1,
  },

  logRange: {
    fontSize: 14,
    color: TEXT,
    fontWeight: '500',
  },

  logSub: {
    marginTop: 2,
    fontSize: 11,
    color: MUTED,
  },

  latestBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: PINK_SOFT,
    marginLeft: 8,
  },

  latestBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: PINK,
  },

  logDelete: {
    marginLeft: 12,
  },

  showMore: {
    marginTop: 14,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PINK_SOFT,
  },

  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: PINK,
  },

  /* SHARING NOTE */

  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginTop: 24,
  },

  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PINK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteText: {
    flex: 1,
    marginLeft: 12,
  },

  noteTitle: {
    fontSize: 13,
    color: TEXT,
    fontWeight: '500',
  },

  noteDescription: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: MUTED,
  },

  /* BOTTOM NAV */

  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 10,
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    minHeight: 52,
  },

  tabLabel: {
    marginTop: 3,
    fontSize: 11,
  },

  /* SHEETS */

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(25,25,35,0.28)',
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

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
  },

  sheetHeaderText: {
    flex: 1,
  },

  sheetBusy: {
    marginRight: 12,
  },

  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetScroll: {
    paddingHorizontal: 22,
    paddingTop: 16,
  },

  sheetTitle: {
    fontSize: 22,
    color: TEXT,
    fontWeight: '500',
  },

  sheetSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: MUTED,
  },

  sheetLabel: {
    marginTop: 20,
    marginBottom: 9,
    fontSize: 12,
    color: TEXT,
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
    borderColor: LINE,
    backgroundColor: '#FFFFFF',
  },

  chipActive: {
    backgroundColor: PINK_SOFT,
    borderColor: PINK_BORDER,
  },

  chipText: {
    fontSize: 12,
    color: MUTED,
  },

  chipTextActive: {
    color: PINK,
    fontWeight: '600',
  },

  loggedBlock: {
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
    color: TEXT,
  },

  saveButton: {
    marginTop: 25,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PINK,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});