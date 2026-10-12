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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  includeLatestPeriodSummary,
  parseDate,
  PeriodDashboard,
  PeriodLog,
  PeriodSettings,
  savePeriodSymptom,
  SymptomSeverity,
  updatePeriod,
} from '../lib/period';

import { getAccountState } from '../lib/account';
import { CycleDailyLog, DailyStatus, getCycleDailyLogs, getDailyStatus, getSharedDailyWellness, saveCycleDailyLog, saveDailyStatus, saveSharedCravings, saveSharedDailyWellness, SharedDailyWellness, subscribeCycleFeatures } from '../lib/cycleFeatures';
import { loadNotificationsModule, scheduleCycleReminders } from '../lib/pushNotifications';
import { formatPredictionWindow, predictCycle } from '../lib/cyclePrediction';

// ⚠️ Adjust these names if your partnerMessages.ts exports different ones.
import {
  getPartnerMessages,
  PartnerMessage,
  sendPartnerMessage,
  subscribePartnerMessages,
} from '../lib/partnerMessages';

import AnimatedCountBadge from '../components/AnimatedCountBadge';
import CycleTabBar from '../components/CycleTabBar';
import RelationshipNotificationModal from '../components/RelationshipNotificationModal';
import { useUnreadNotificationCount } from '../hooks/use-unread-notification-count';
import { FadeIn, PressScale, Screen } from '../lib/ui';

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
  betweenUs: '/between-us',
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

// Daily Wellness overlay palette (soft dusty rose)
const W = {
  sheet: '#FDF4F5',
  card: '#FFFFFF',
  cardBorder: '#F8E6E9',
  tile: '#FBEDEF',
  tileActive: '#FADDE2',
  tileActiveBorder: '#E9A2AE',
  face: '#F5BBC3',
  ink: '#4A2E3A',
  inkSoft: '#7A5B67',
  accent: '#E58C9C',
  accentDeep: '#DE8697',
  handle: '#E6C6CC',
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
    partnerLine1: string;
    partnerLine2: string;
  }
> = {
  Period: {
    title: 'Menstruation',
    icon: 'water-outline',
    accent: C.pink,
    line1: 'Your body is renewing.',
    line2: 'Take it easy today.',
    partnerLine1: 'Her body is renewing.',
    partnerLine2: 'She may need extra rest today.',
  },
  Follicular: {
    title: 'Follicular',
    icon: 'leaf-outline',
    accent: C.green,
    line1: 'Your energy is building.',
    line2: 'A fresh start is here.',
    partnerLine1: 'Her energy is building.',
    partnerLine2: 'A fresh start is here.',
  },
  Ovulation: {
    title: 'Ovulation',
    icon: 'flower-outline',
    accent: C.peach,
    line1: 'You may feel more energetic.',
    line2: 'Enjoy the extra energy.',
    partnerLine1: 'Her energy may feel higher.',
    partnerLine2: 'She may enjoy making plans.',
  },
  Luteal: {
    title: 'Luteal',
    icon: 'moon-outline',
    accent: C.purple,
    line1: 'Time to slow down.',
    line2: 'Be gentle with yourself.',
    partnerLine1: 'It may be time for her to slow down.',
    partnerLine2: 'A little extra care can help.',
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
const WELLNESS_MOODS: { value: string; label: string }[] = [
  { value: '😊', label: 'Great' },
  { value: '😌', label: 'Calm' },
  { value: '😔', label: 'Low' },
  { value: '😟', label: 'Anxious' },
  { value: '😤', label: 'Irritable' },
  { value: '😶', label: 'Empty' },
];
const CRAVING_SUGGESTIONS = ['Chocolate', 'Salty snacks', 'Something sweet', 'Spicy food'];
const TODAY_STATUSES = ['Need cuddles', 'Need space', 'Feeling great', 'Low energy'] as const;

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
type SupplementReminder = { id: string; name: string; time: string; notificationId?: string; takenDate?: string };

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

function formatShortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatPhaseDate(date: string, today: string) {
  const distance = Math.max(0, Math.round(
    (parseDate(date).getTime() - parseDate(today).getTime()) / 86400000
  ));
  const timing = distance === 0
    ? 'today'
    : distance === 1
      ? 'tomorrow'
      : distance <= 6
        ? `in ${distance} days`
        : distance <= 13
          ? 'next week'
          : `in ${distance} days`;
  const shortDate = parseDate(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${timing} · ${shortDate}`;
}

function getNextPhaseEstimate(
  phase: CyclePhase,
  ovulationDate: string | null,
  nextPeriodDate: string | null,
  latestPeriodStart: string | null,
  latestPeriodEnd: string | null,
  averagePeriodLength: number,
  averageCycleLength: number,
  today: string,
) {
  if (!latestPeriodStart) return null;

  let nextPhase: CyclePhase;
  let date: string | null;
  switch (phase) {
    case 'Period':
      nextPhase = 'Follicular';
      date = latestPeriodEnd
        ? addDays(latestPeriodEnd, 1)
        : addDays(latestPeriodStart, Math.max(1, averagePeriodLength));
      break;
    case 'Follicular':
      nextPhase = 'Ovulation';
      date = ovulationDate ? addDays(ovulationDate, -1) : null;
      break;
    case 'Ovulation':
      nextPhase = 'Luteal';
      date = ovulationDate ? addDays(ovulationDate, 2) : null;
      break;
    case 'Luteal':
    default:
      nextPhase = 'Period';
      date = nextPeriodDate;
      break;
  }

  if (!date) return null;
  if (date <= today) date = addDays(date, Math.max(1, averageCycleLength));
  return { phase: nextPhase, date, timing: formatPhaseDate(date, today) };
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
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
  const [logsModal, setLogsModal] = useState(false);
  const [symptomType, setSymptomType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [mood, setMood] = useState<string | null>(null);

  // Messages + notifications
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Your partner');
  const [notifOpen, setNotifOpen] = useState(false);
  const relationshipUnreadCount = useUnreadNotificationCount();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [replyTo, setReplyTo] = useState<PartnerMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sharedWellnessLogs, setSharedWellnessLogs] = useState<SharedDailyWellness[]>([]);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null);
  const [statusOverlayVisible, setStatusOverlayVisible] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [wellnessTool, setWellnessTool] = useState<'daily' | 'cravings' | 'supplements' | null>(null);
  const [dailyMood, setDailyMood] = useState<string | null>(null);
  const [dailyEnergy, setDailyEnergy] = useState(3);
  const [flowIntensity, setFlowIntensity] = useState<CycleDailyLog['flow_intensity']>(null);
  const [cravingsText, setCravingsText] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [waterGlasses, setWaterGlasses] = useState('0');
  const [exerciseMinutes, setExerciseMinutes] = useState('0');
  const [supplements, setSupplements] = useState<SupplementReminder[]>([]);
  const [supplementName, setSupplementName] = useState('');
  const [supplementTime, setSupplementTime] = useState('09:00');
  const [cycleRemindersEnabled, setCycleRemindersEnabled] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const symptomsY = useRef(0);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(1)).current;

  // Header animations
  const headerIn = useRef(new Animated.Value(0)).current;
  const bellWiggle = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadDashboard = useCallback(async () => {
    let resolvedId: string | undefined;
    try {
      const account = await getAccountState();
      resolvedId = account.user_id;
      const data = await getPeriodDashboard();
      setDashboard(data);
      const accountId = resolvedId || null;
      const cacheKey = accountId ? `@betweenus_dashboard_v1_${accountId}` : null;
      if (cacheKey) await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      const isPartnerView = account.role === 'boyfriend';
      const reminderPeriods = isPartnerView
        ? includeLatestPeriodSummary(data.partner?.periods ?? [], data.partner?.settings?.latest_period_start ?? null)
        : data.own.periods;
      const reminderSettings = isPartnerView
        ? { ...FALLBACK_SETTINGS, average_cycle_length: data.partner?.settings?.average_cycle_length || 28, average_period_length: data.partner?.settings?.average_period_length || 5 }
        : data.own.settings;
      const predicted = getPredictedNextPeriod(reminderPeriods, reminderSettings.average_cycle_length);
      const current = getCurrentCycleInfo(reminderPeriods, reminderSettings);
      const fertilityPrediction = predictCycle(reminderPeriods, reminderSettings);
      const fertileWindowStart = fertilityPrediction.confidence === 'higher'
        ? current.fertileWindow.start
        : null;
      void scheduleCycleReminders(predicted, fertileWindowStart, isPartnerView).catch((error) => console.warn('Could not schedule cycle reminders:', error));
    } catch (error: any) {
      console.error('PERIOD LOAD ERROR:', error);
      const cacheKey = resolvedId ? `@betweenus_dashboard_v1_${resolvedId}` : null;
      const cached = cacheKey ? await AsyncStorage.getItem(cacheKey) : null;
      if (cached) setDashboard(JSON.parse(cached));
      else Alert.alert('Unable to load period data', error?.message || 'Please check your connection and try again.');
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
          let preloaded: PeriodDashboard | null = null;
          const accountRole = detectRole(account);

          const accountId = account?.user_id || account?.id || null;
          setMyId(accountId);
          setPartnerName(detectPartnerName(account));
          if (accountId) {
            setCycleRemindersEnabled((await AsyncStorage.getItem('@betweenus_cycle_reminders_enabled_v1')) === 'on');
            const savedSupplements = await AsyncStorage.getItem(`@betweenus_supplements_v1_${accountId}`);
            if (savedSupplements) setSupplements(JSON.parse(savedSupplements));
            const [logs, status, sharedLogs] = await Promise.all([getCycleDailyLogs(accountId).catch(() => []), getDailyStatus().catch(() => null), getSharedDailyWellness().catch(() => [])]);
            if (!mounted) return;
            setDailyStatus(status);
            setSharedWellnessLogs(sharedLogs);
            const todayWellness = sharedLogs.find((log) => log.log_date === todayString());
            if (todayWellness) {
              setDailyMood(todayWellness.mood);
              setDailyEnergy(todayWellness.energy_level ?? 3);
              setFlowIntensity(todayWellness.flow_intensity);
              setCravingsText(todayWellness.cravings.join(', '));
            }
            if (accountRole !== 'boyfriend') {
              const todayLog = logs.find((log) => log.log_date === todayString());
              if (todayLog) {
                setSleepHours(todayLog.sleep_hours?.toString() ?? '');
                setWaterGlasses(String(todayLog.water_glasses));
                setExerciseMinutes(String(todayLog.exercise_minutes));
              }
            }
          }

          let isBoyfriend: boolean;
          // The authenticated account is authoritative. Route params and a
          // locally cached role can be stale and may show the wrong user's data.
          if (accountRole === 'girlfriend') {
            isBoyfriend = false;
          } else if (accountRole === 'boyfriend') {
            isBoyfriend = true;
          } else {
            preloaded = await getPeriodDashboard();
            const role: 'boyfriend' | 'girlfriend' =
              partnerHasData(preloaded) &&
              (preloaded.own.periods?.length || 0) === 0
                ? 'boyfriend'
                : 'girlfriend';
            isBoyfriend = role === 'boyfriend';
          }

          if (!mounted) return;

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

      let unsubscribeMessages: (() => void) | undefined;
      let unsubscribeFeatures: (() => void) | undefined;
      void subscribePartnerMessages(() => { void loadMessages(); }).then((unsubscribe) => {
        if (mounted) unsubscribeMessages = unsubscribe;
        else unsubscribe();
      }).catch((error) => console.warn('Message realtime unavailable:', error));
      void subscribeCycleFeatures(() => {
        void getSharedDailyWellness().then(setSharedWellnessLogs).catch(() => undefined);
        void getDailyStatus().then(setDailyStatus).catch(() => undefined);
      }).then((unsubscribe) => {
        if (mounted) unsubscribeFeatures = unsubscribe;
        else unsubscribe();
      }).catch((error) => console.warn('Cycle realtime unavailable:', error));

      return () => {
        mounted = false;
        unsubscribeMessages?.();
        unsubscribeFeatures?.();
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

  const partnerPeriods = includeLatestPeriodSummary(
    partnerPeriodsRaw,
    partnerLatestStart
  );

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
  const cyclePrediction = useMemo(
    () => predictCycle(periods, settings, today),
    [periods, settings, today],
  );
  const cycleLength = cyclePrediction.cycleLengthUsed || settings.average_cycle_length || 28;
  const periodLength = settings.average_period_length || 5;
  const todayIsEstimatedFertile =
    cyclePrediction.confidence === 'higher' &&
    !!cyclePrediction.fertileWindowStart &&
    !!cyclePrediction.fertileWindowEnd &&
    today >= cyclePrediction.fertileWindowStart &&
    today <= cyclePrediction.fertileWindowEnd;
  const fertilityNote = todayIsEstimatedFertile
    ? 'Estimated fertile window · pregnancy chance may be higher'
    : cyclePrediction.confidence === 'higher'
      ? 'Pregnancy can still be possible outside this estimate'
      : 'Pregnancy is possible; date-based timing is uncertain';

  const latestPeriod = useMemo(
    () =>
      [...periods].sort((a, b) =>
        b.start_date.localeCompare(a.start_date)
      )[0] || null,
    [periods]
  );

  const currentCycle = getCurrentCycleInfo(periods, settings);

  const stripStart = today;

  const stripDates = Array.from({ length: 10 }, (_, i) =>
    addDays(stripStart, i)
  );

  const activeDate =
    selectedDate && stripDates.includes(selectedDate)
      ? selectedDate
      : stripDates.includes(today)
        ? today
        : stripDates[0];

  // The hero always reports the current cycle phase. Calendar cells remain
  // date-specific, so selecting another day cannot make the two accounts'
  // current-phase cards disagree.
  const activeInfo = currentCycle;
  const activePhase: CyclePhase = activeInfo.phase || 'Period';
  const shownPhase: CyclePhase = hasCycleData ? activePhase : 'Period';
  const activeCopy = PHASE_COPY[shownPhase];
  const theme = PHASE_THEME[shownPhase];
  const accent = activeCopy.accent;

  const predictedNext = cyclePrediction.nextPeriodDate;
  const nextPhaseEstimate = hasCycleData
    ? getNextPhaseEstimate(
        currentCycle.phase,
        currentCycle.ovulationDate,
        predictedNext,
        latestPeriod?.start_date || null,
        latestPeriod?.end_date || null,
        periodLength,
        cycleLength,
        today,
      )
    : null;

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

  // Header title entrance
  useEffect(() => {
    Animated.timing(headerIn, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [headerIn]);

  // Bell wiggles every few seconds while there are unread notifications
  useEffect(() => {
    if (relationshipUnreadCount <= 0) {
      bellWiggle.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bellWiggle, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: -1, duration: 140, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: -1, duration: 140, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.delay(3800),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [bellWiggle, relationshipUnreadCount]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  const headerTitleY = headerIn.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  const bellRotate = bellWiggle.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-16deg', '16deg'],
  });

  const headerHairlineOpacity = scrollY.interpolate({
    inputRange: [0, 28],
    outputRange: [0, 1],
    extrapolate: 'clamp',
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
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadMessages(), getSharedDailyWellness().then(setSharedWellnessLogs).catch(() => undefined), getDailyStatus().then(setDailyStatus).catch(() => undefined)]);
    setRefreshing(false);
  }

  async function saveDailyLog() {
    if (viewerMode || saving) return;
    try {
      setSaving(true);
      await saveCycleDailyLog({
        log_date: today,
        mood: dailyMood,
        energy_level: dailyEnergy,
        flow_intensity: activePhase === 'Period' ? flowIntensity : null,
        cravings: cravingsText.split(',').map((item) => item.trim()).filter(Boolean),
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        water_glasses: Math.max(0, Number(waterGlasses) || 0),
        exercise_minutes: Math.max(0, Number(exerciseMinutes) || 0),
      });
      await saveSharedDailyWellness({
        log_date: today,
        mood: dailyMood,
        energy_level: dailyEnergy,
        flow_intensity: activePhase === 'Period' ? flowIntensity : null,
        cravings: cravingsText.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setSharedWellnessLogs(await getSharedDailyWellness());
      Alert.alert('Saved', 'Your daily log has been saved.');
    } catch (error: any) {
      Alert.alert('Could not save daily log', error?.message || 'Please try again.');
    } finally { setSaving(false); }
  }

  async function saveCravings() {
    if (viewerMode || saving) return;
    try {
      setSaving(true);
      const cravings = cravingsText.split(',').map((item) => item.trim()).filter(Boolean);
      await saveSharedCravings(cravings, today);
      setSharedWellnessLogs(await getSharedDailyWellness());
      Alert.alert('Saved', "Today's cravings have been shared with your partner.");
    } catch (error: any) {
      Alert.alert('Could not save cravings', error?.message || 'Please try again.');
    } finally { setSaving(false); }
  }

  async function chooseDailyStatus(status: string) {
    if (viewerMode || saving) return;
    setSaving(true);
    setDailyStatus({ user_id: myId || '', log_date: today, status, updated_at: new Date().toISOString() });
    try {
      await saveDailyStatus(status, today);
      setStatusOverlayVisible(false);
      setCustomStatus('');
    } catch (error: any) {
      Alert.alert('Could not update status', error?.message || 'Please try again.');
      void getDailyStatus().then(setDailyStatus);
    } finally { setSaving(false); }
  }

  async function addSupplementReminder() {
    const name = supplementName.trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(supplementTime.trim());
    if (!name || !match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      Alert.alert('Check the reminder', 'Add a supplement name and time in 24-hour HH:MM format.');
      return;
    }
    try {
      const Notifications = await loadNotificationsModule();
      if (!Notifications) throw new Error('Local reminders are unavailable in this build.');
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('supplement-reminders', { name: 'Supplement reminders', importance: Notifications.AndroidImportance.DEFAULT });
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Allow notifications in device settings to set reminders.');
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: 'Supplement reminder', body: `Time to take ${name}.`, ...(Platform.OS === 'android' ? { channelId: 'supplement-reminders' } : {}) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: Number(match[1]), minute: Number(match[2]), repeats: true },
      });
      const next = [...supplements, { id: `${Date.now()}`, name, time: supplementTime.trim(), notificationId }];
      setSupplements(next);
      if (myId) await AsyncStorage.setItem(`@betweenus_supplements_v1_${myId}`, JSON.stringify(next));
      setSupplementName('');
    } catch (error: any) { Alert.alert('Could not set reminder', error?.message || 'Please try again.'); }
  }

  async function toggleSupplementTaken(id: string) {
    const next = supplements.map((item) => item.id === id ? { ...item, takenDate: item.takenDate === today ? undefined : today } : item);
    setSupplements(next);
    if (myId) await AsyncStorage.setItem(`@betweenus_supplements_v1_${myId}`, JSON.stringify(next));
  }

  async function toggleCycleReminders(enabled: boolean) {
    if (enabled) {
      const Notifications = await loadNotificationsModule();
      if (!Notifications) { Alert.alert('Reminders unavailable', 'Local notifications are unavailable on this platform.'); return; }
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('cycle-reminders', { name: 'Cycle reminders', importance: Notifications.AndroidImportance.DEFAULT });
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') { Alert.alert('Notifications are off', 'Allow notifications in device settings to receive cycle reminders.'); return; }
      await AsyncStorage.setItem('@betweenus_cycle_reminders_enabled_v1', 'on');
      setCycleRemindersEnabled(true);
      await refresh();
      return;
    }
    await AsyncStorage.setItem('@betweenus_cycle_reminders_enabled_v1', 'off');
    setCycleRemindersEnabled(false);
    const Notifications = await loadNotificationsModule();
    const ids = JSON.parse((await AsyncStorage.getItem('@betweenus_cycle_reminder_ids_v1')) || '[]') as string[];
    if (Notifications) for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    await AsyncStorage.removeItem('@betweenus_cycle_reminder_ids_v1');
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

        {/* SLIM STICKY HEADER */}
        <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              {router.canGoBack?.() ? (
                <PressScale
                  onPress={() => router.back()}
                  scaleTo={0.88}
                  style={styles.headerBack}
                  contentStyle={styles.headerBackContent}
                >
                  <Ionicons name="chevron-back" size={20} color={theme.ink} />
                </PressScale>
              ) : null}

              <Animated.View
                style={[
                  styles.headerTextGroup,
                  { opacity: headerIn, transform: [{ translateY: headerTitleY }] },
                ]}
              >
                <Text style={[styles.headerTitle, { color: theme.ink }]}>
                  {viewerMode ? 'Her Period' : 'My Period'}
                </Text>
              </Animated.View>
            </View>

            <PressScale
              onPress={() => setNotifOpen(true)}
              scaleTo={0.88}
              style={styles.headerBell}
              contentStyle={styles.headerBellContent}
            >
              <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
                <Ionicons
                  name={
                    relationshipUnreadCount > 0 ? 'notifications' : 'notifications-outline'
                  }
                  size={20}
                  color={theme.ink}
                />
              </Animated.View>
              <AnimatedCountBadge
                count={relationshipUnreadCount}
                containerStyle={styles.bellBadge}
                textStyle={styles.bellBadgeText}
              />
            </PressScale>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[styles.headerHairline, { opacity: headerHairlineOpacity }]}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={C.pink} colors={[C.pink]} />}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: 24 + insets.bottom, paddingTop: 6 },
          ]}
        >
          {/* DATE STRIP */}
          <View style={styles.todayDateBlock}>
            <Text style={styles.todayDateLabel}>Date Today</Text>
            <Text style={styles.todayDateValue}>{parseDate(today).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          </View>
          <FadeIn delay={40}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
            >
              {stripDates.map((date) => {
                const active = date === activeDate;
                const info = getCycleInfoForDate(periods, settings, date);
                const number = String(parseDate(date).getDate());
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
                {viewerMode ? 'HER CYCLE PHASE' : 'MENSTRUAL CYCLE PHASE'}
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
                  ? viewerMode
                    ? `${PHASE_COPY[activePhase].partnerLine1}\n${PHASE_COPY[activePhase].partnerLine2}`
                    : `${PHASE_COPY[activePhase].line1}\n${PHASE_COPY[activePhase].line2}`
                  : viewerMode
                    ? 'She hasn’t logged yet. Send a gentle reminder?'
                    : 'Log your first period to begin tracking.'}
              </Text>

              {viewerMode && !hasCycleData ? (
                <Pressable style={styles.outlineButton} onPress={() => { setComposeText('When you have a moment, could you add your period dates? I want to support you.'); setReplyTo(null); setComposeOpen(true); }}>
                  <Text style={styles.outlineButtonText}>Send a gentle reminder</Text>
                </Pressable>
              ) : null}

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

          {/* CYCLE OVERVIEW — minimalist */}
          <FadeIn delay={110}>
            <View style={styles.overviewHeading}>
              <Text style={styles.overviewTitle}>Cycle overview</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={styles.overviewStats}>
                <OverviewStat
                  icon="calendar-outline"
                  label="Next period"
                  value={formatShortDate(predictedNext)}
                  color={C.pink}
                />
                <View style={styles.overviewVDivider} />
                <OverviewStat
                  icon="repeat-outline"
                  label="Cycle"
                  value={`${cycleLength} days`}
                  color={C.purple}
                />
                <View style={styles.overviewVDivider} />
                <OverviewStat
                  icon="water-outline"
                  label="Period"
                  value={`${displayPeriodLength} days`}
                  color={C.peach}
                />
              </View>

              <Text style={styles.predictionNote}>
                {cyclePrediction.historyCount > 1
                  ? `Expected window: ${formatPredictionWindow(cyclePrediction.nextPeriodWindowStart, cyclePrediction.nextPeriodWindowEnd)}. ${cyclePrediction.summary}`
                  : `Early estimate window: ${formatPredictionWindow(cyclePrediction.nextPeriodWindowStart, cyclePrediction.nextPeriodWindowEnd)}. ${cyclePrediction.summary}`}
              </Text>
              <View style={styles.fertilityNote}>
                <Ionicons name="heart-outline" size={12} color={C.muted} />
                <Text style={styles.fertilityNoteText}>{fertilityNote}</Text>
              </View>

              <View style={styles.overviewDivider} />

              <View style={styles.overviewRow}>
                <Ionicons name="sparkles-outline" size={14} color={C.purple} />
                <Text style={styles.overviewRowText} numberOfLines={1}>
                  {nextPhaseEstimate
                    ? `Next: ${nextPhaseEstimate.phase} · ${nextPhaseEstimate.timing}`
                    : viewerMode
                      ? 'Her next phase appears once she logs a period.'
                      : 'Log a period to see your next phase.'}
                </Text>
              </View>

              <View style={styles.overviewRow}>
                <Ionicons name="notifications-outline" size={14} color={C.muted} />
                <Text style={[styles.overviewRowText, { color: C.muted }]} numberOfLines={1}>
                  Cycle reminders
                </Text>
                <Switch
                  value={cycleRemindersEnabled}
                  onValueChange={(value) => { void toggleCycleReminders(value); }}
                  trackColor={{ true: '#F7B7C3' }}
                  thumbColor={cycleRemindersEnabled ? C.pink : '#FFFFFF'}
                  style={styles.overviewSwitch}
                />
              </View>
            </View>
          </FadeIn>

          {/* QUICK FEATURE ROW — HORIZONTAL */}
          <FadeIn delay={150}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Your Tools</Text>
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
                subtitle={viewerMode ? 'Her cycle at a glance' : 'Your cycle at a glance'}
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
                subtitle={viewerMode ? 'Her period history' : 'Your period history'}
                icon="time-outline"
                color={C.pink}
                background={C.pinkSoft}
                onPress={() => setLogsModal(true)}
              />
            </ScrollView>
          </FadeIn>

          {/* TODAY: QUICK ACTIONS */}
          <FadeIn delay={190}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Today</Text>
              <Text style={styles.todayCaption}>
                {unreadCount > 0
                  ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}`
                  : 'Small ways to stay connected today'}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.todayScroller}
            >
              <RelationshipCard
                title="Today’s Want"
                subtitle={
                  viewerMode
                    ? "Add a little thing you’d love her to do."
                    : "Add something you’d love him to do."
                }
                icon="heart"
                background={C.pinkSoft}
                color={C.pink}
                onPress={() => openRoute(ROUTES.want)}
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
                title="Check-in"
                subtitle="Share today’s feeling or mood."
                icon="pulse"
                background={C.blueSoft}
                color={C.blue}
                onPress={() => openRoute(ROUTES.checkIn)}
              />
              <RelationshipCard
                title="Status"
                subtitle={viewerMode ? dailyStatus?.status ?? "She hasn't logged yet." : dailyStatus?.status ?? "Set today's status."}
                icon="pulse"
                background={C.purpleSoft}
                color={C.purple}
                onPress={() => { if (!viewerMode) setStatusOverlayVisible(true); }}
              />
            </ScrollView>


          </FadeIn>

          <View style={styles.wellnessSection}>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Wellness</Text></View>
              <View style={styles.wellnessActions}>
                <Pressable style={styles.wellnessAction} onPress={() => setWellnessTool('daily')} accessibilityRole="button">
                  <View style={[styles.wellnessActionIcon, { backgroundColor: C.purpleSoft }]}><Ionicons name="heart-outline" size={17} color={C.purple} /></View>
                  <Text style={styles.wellnessActionTitle}>Daily{ '\n' }Wellness</Text>
                </Pressable>
                <Pressable style={styles.wellnessAction} onPress={() => setWellnessTool('cravings')} accessibilityRole="button">
                  <View style={[styles.wellnessActionIcon, { backgroundColor: C.pinkSoft }]}><Ionicons name="restaurant-outline" size={17} color={C.pink} /></View>
                  <Text style={styles.wellnessActionTitle}>Cravings</Text>
                </Pressable>
                {!viewerMode ? <Pressable style={styles.wellnessAction} onPress={() => setWellnessTool('supplements')} accessibilityRole="button">
                  <View style={[styles.wellnessActionIcon, { backgroundColor: C.peachSoft }]}><Ionicons name="medical-outline" size={17} color={C.peach} /></View>
                  <Text style={styles.wellnessActionTitle}>Pills &{ '\n' }Supplements</Text>
                </Pressable> : null}
              </View>
          </View>

          {/* WELLNESS OVERLAY — compact floating card */}
          <Modal
            visible={wellnessTool !== null && (!viewerMode || wellnessTool !== 'supplements')}
            transparent
            animationType="slide"
            onRequestClose={() => setWellnessTool(null)}
          >
            <KeyboardAvoidingView
              style={styles.modalRoot}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Pressable style={styles.modalBackdrop} onPress={() => setWellnessTool(null)} />
              <View style={[styles.wellSheet, { marginBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.wellHandle} />

                <View style={styles.wellHeader}>
                  <Pressable onPress={() => setWellnessTool(null)} style={styles.wellClose} accessibilityRole="button" accessibilityLabel="Close wellness" hitSlop={10}>
                    <Ionicons name="close" size={20} color={W.accent} />
                  </Pressable>
                  <View style={styles.wellHeaderCenter}>
                    <Text style={styles.wellTitle}>
                      {wellnessTool === 'daily' ? 'Daily Wellness' : wellnessTool === 'cravings' ? 'Cravings' : 'Pills & Supplements'}
                    </Text>
                    <Text style={styles.wellSubtitle}>
                      {viewerMode
                        ? 'Shared from her daily log.'
                        : wellnessTool === 'supplements'
                          ? 'Private reminders for your routine.'
                          : wellnessTool === 'cravings'
                            ? 'Let your partner know what you want.'
                            : 'How are you feeling today?'}
                      {!viewerMode && wellnessTool === 'daily' ? ' ' : ''}
                      {!viewerMode && wellnessTool === 'daily' ? <Ionicons name="heart-outline" size={12} color={W.accent} /> : null}
                    </Text>
                  </View>
                  <View style={styles.wellClose} />
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.wellScroll}
                >
                  {wellnessTool === 'daily' ? (
                    viewerMode ? (() => {
                      const todayWellness = sharedWellnessLogs.find((log) => log.log_date === todayString());
                      return (
                        <>
                          <View style={styles.wellCard}>
                            {todayWellness ? (
                              <>
                                <Text style={styles.sharedWellnessValue}>Mood · {todayWellness.mood || 'Not logged'}</Text>
                                <Text style={styles.sharedWellnessValue}>Energy · {todayWellness.energy_level ?? 'Not logged'} / 5</Text>
                                {todayWellness.flow_intensity ? <Text style={styles.sharedWellnessValue}>Flow · {capitalize(todayWellness.flow_intensity)}</Text> : null}
                              </>
                            ) : (
                              <Text style={styles.dailyCaption}>She hasn&apos;t logged wellness today.</Text>
                            )}
                          </View>
                          <View style={styles.wellCard}>
                            <Text style={styles.wellCardTitle}>History</Text>
                            {sharedWellnessLogs.length
                              ? sharedWellnessLogs.slice(0, 7).map((log) => (
                                  <Text key={log.log_date} style={styles.dailyHistory}>
                                    {log.log_date} · {log.mood || 'No mood'} · energy {log.energy_level ?? '-'}
                                    {log.flow_intensity ? ` · ${log.flow_intensity} flow` : ''}
                                  </Text>
                                ))
                              : <Text style={styles.dailyCaption}>Daily wellness history will appear here.</Text>}
                          </View>
                        </>
                      );
                    })() : (
                      <>
                        {/* MOOD */}
                        <View style={styles.wellCard}>
                          <View style={styles.wellCardHeader}>
                            <View style={styles.wellCardIcon}><Ionicons name="happy-outline" size={16} color={W.accent} /></View>
                            <Text style={styles.wellCardTitle}>Mood</Text>
                          </View>
                          <View style={styles.moodGrid}>
                            {WELLNESS_MOODS.map((item) => {
                              const active = dailyMood === item.value;
                              return (
                                <Pressable
                                  key={item.value}
                                  onPress={() => setDailyMood(item.value)}
                                  style={[styles.moodTile, active && styles.moodTileActive]}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: active }}
                                >
                                  <View style={styles.moodFace}><Text style={styles.moodFaceEmoji}>{item.value}</Text></View>
                                  <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{item.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        {/* ENERGY */}
                        <View style={styles.wellCard}>
                          <View style={styles.wellCardHeader}>
                            <Ionicons name="flash-outline" size={20} color={W.accent} />
                            <Text style={styles.wellCardTitle}>Energy: {dailyEnergy}/5</Text>
                          </View>
                          <View style={styles.energyRow}>
                            {[1, 2, 3, 4, 5].map((value) => {
                              const active = dailyEnergy === value;
                              return (
                                <Pressable
                                  key={value}
                                  onPress={() => setDailyEnergy(value)}
                                  style={[styles.energyCircle, active && styles.energyCircleActive]}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: active }}
                                >
                                  <Text style={[styles.energyText, active && styles.energyTextActive]}>{value}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        {/* FLOW */}
                        {activePhase === 'Period' ? (
                          <View style={styles.wellCard}>
                            <View style={styles.wellCardHeader}>
                              <Ionicons name="water-outline" size={20} color={W.accent} />
                              <Text style={styles.wellCardTitle}>Flow Intensity</Text>
                            </View>
                            <View style={styles.flowRow}>
                              {(['light', 'medium', 'heavy'] as const).map((value) => {
                                const active = flowIntensity === value;
                                return (
                                  <Pressable
                                    key={value}
                                    onPress={() => setFlowIntensity(value)}
                                    style={[styles.flowPill, active && styles.flowPillActive]}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                  >
                                    <Text style={[styles.flowText, active && styles.flowTextActive]}>{capitalize(value)}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}

                        <Pressable
                          onPress={() => void saveDailyLog()}
                          disabled={saving}
                          style={[styles.wellSave, saving && styles.primaryButtonDisabled]}
                          accessibilityRole="button"
                        >
                          <Ionicons name="bookmark-outline" size={18} color={C.white} />
                          <Text style={styles.wellSaveText}>{saving ? 'Saving...' : "Save today's wellness"}</Text>
                        </Pressable>

                        {sharedWellnessLogs.length ? (
                          <View style={styles.wellCard}>
                            <Text style={styles.wellCardTitle}>History</Text>
                            {sharedWellnessLogs.slice(0, 5).map((log) => (
                              <Text key={log.log_date} style={styles.dailyHistory}>
                                {log.log_date} · {log.mood || 'No mood'} · energy {log.energy_level ?? '-'}
                                {log.flow_intensity ? ` · ${log.flow_intensity} flow` : ''}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </>
                    )
                  ) : null}

                  {wellnessTool === 'cravings' ? (
                    viewerMode ? (
                      <View style={styles.wellCard}>
                        {sharedWellnessLogs.filter((log) => log.cravings.length > 0).slice(0, 7).map((log) => (
                          <View key={log.log_date} style={styles.cravingHistoryRow}>
                            <Text style={styles.dailyLabel}>{log.log_date}</Text>
                            <Text style={styles.sharedWellnessValue}>{log.cravings.join(', ')}</Text>
                          </View>
                        ))}
                        {!sharedWellnessLogs.some((log) => log.cravings.length > 0) ? <Text style={styles.dailyCaption}>She hasn&apos;t shared any cravings yet.</Text> : null}
                      </View>
                    ) : (
                      <>
                        <View style={styles.wellCard}>
                          <View style={styles.wellCardHeader}>
                            <View style={styles.wellCardIcon}><Ionicons name="restaurant-outline" size={16} color={W.accent} /></View>
                            <Text style={styles.wellCardTitle}>Suggestions</Text>
                          </View>
                          <View style={styles.dailyChipWrap}>
                            {CRAVING_SUGGESTIONS.map((craving) => (
                              <Pressable
                                key={craving}
                                onPress={() => {
                                  const current = cravingsText.split(',').map((item) => item.trim()).filter(Boolean);
                                  if (!current.includes(craving)) setCravingsText([...current, craving].join(', '));
                                }}
                                style={styles.wellChip}
                              >
                                <Text style={styles.wellChipText}>{craving}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput
                            value={cravingsText}
                            onChangeText={setCravingsText}
                            placeholder="Add a craving"
                            placeholderTextColor={C.faint}
                            style={styles.wellInput}
                            maxLength={240}
                          />
                        </View>
                        <Pressable onPress={() => void saveCravings()} disabled={saving} style={[styles.wellSave, saving && styles.primaryButtonDisabled]}>
                          <Ionicons name="bookmark-outline" size={18} color={C.white} />
                          <Text style={styles.wellSaveText}>{saving ? 'Saving...' : "Share today's cravings"}</Text>
                        </Pressable>
                      </>
                    )
                  ) : null}

                  {wellnessTool === 'supplements' && !viewerMode ? (
                    <>
                      <View style={styles.wellCard}>
                        <View style={styles.wellCardHeader}>
                          <View style={styles.wellCardIcon}><Ionicons name="medical-outline" size={16} color={W.accent} /></View>
                          <Text style={styles.wellCardTitle}>New reminder</Text>
                        </View>
                        <View style={styles.dailyInputRow}>
                          <TextInput value={supplementName} onChangeText={setSupplementName} placeholder="Birth control, iron, vitamins" placeholderTextColor={C.faint} style={[styles.wellInput, { flex: 1 }]} />
                          <TextInput value={supplementTime} onChangeText={setSupplementTime} placeholder="09:00" placeholderTextColor={C.faint} style={[styles.wellInput, { width: 76 }]} />
                        </View>
                      </View>
                      <Pressable onPress={() => void addSupplementReminder()} style={styles.wellSave}>
                        <Ionicons name="alarm-outline" size={18} color={C.white} />
                        <Text style={styles.wellSaveText}>Add daily reminder</Text>
                      </Pressable>
                      {supplements.length ? (
                        <View style={styles.wellCard}>
                          {supplements.map((item) => (
                            <View key={item.id} style={styles.supplementRow}>
                              <Text style={[styles.dailyHistory, { flex: 1, borderTopWidth: 0 }]}>{item.name} · {item.time}</Text>
                              <Pressable onPress={() => void toggleSupplementTaken(item.id)} style={[styles.takenButton, item.takenDate === today && styles.takenButtonActive]}>
                                <Text style={[styles.choiceText, item.takenDate === today && styles.choiceTextActive]}>{item.takenDate === today ? 'Taken' : 'Mark taken'}</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

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

        <CycleTabBar active="home" />

        <Modal
          visible={statusOverlayVisible && !viewerMode}
          transparent
          animationType="fade"
          onRequestClose={() => setStatusOverlayVisible(false)}
        >
          <View style={styles.statusOverlayRoot}>
            <Pressable style={styles.modalBackdrop} onPress={() => setStatusOverlayVisible(false)} />
            <View style={styles.statusOverlayCard}>
              <Text style={styles.sheetTitle}>Today&apos;s status</Text>
              <Text style={styles.sheetSubtitle}>Pick a suggestion or write your own.</Text>
              <View style={[styles.dailyChipWrap, styles.statusSuggestionWrap]}>
                {TODAY_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    disabled={saving}
                    onPress={() => void chooseDailyStatus(status)}
                    style={[styles.choiceChip, dailyStatus?.status === status && styles.choiceChipActive]}
                  >
                    <Text style={[styles.choiceText, dailyStatus?.status === status && styles.choiceTextActive]}>{status}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={customStatus}
                onChangeText={setCustomStatus}
                placeholder="Or write your own status"
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={() => { if (customStatus.trim()) void chooseDailyStatus(customStatus.trim()); }}
                style={styles.dailyInput}
              />
              <Pressable
                onPress={() => void chooseDailyStatus(customStatus.trim())}
                disabled={saving || !customStatus.trim()}
                style={[styles.dailySave, (!customStatus.trim() || saving) && styles.primaryButtonDisabled]}
              >
                <Text style={styles.dailySaveText}>{saving ? 'Saving...' : 'Save status'}</Text>
              </Pressable>
              <Pressable onPress={() => setStatusOverlayVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

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
                <View style={styles.dailyChipWrap}>
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
                <View style={styles.dailyChipWrap}>
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
                <View style={styles.dailyChipWrap}>
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

        {/* PERIOD LOGS POPUP */}
        <Modal
          visible={logsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setLogsModal(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={() => setLogsModal(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
                <View style={styles.logsModalHeader}>
                  <View style={styles.logsModalTitleGroup}>
                    <Text style={styles.sheetTitle}>{viewerMode ? 'Her Period Logs' : 'My Period Logs'}</Text>
                    <Text style={styles.sheetSubtitle}>
                      {periods.length} entr{periods.length === 1 ? 'y' : 'ies'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setLogsModal(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close period logs">
                    <Ionicons name="close" size={21} color={C.muted} />
                  </Pressable>
                </View>

                {periods.length === 0 ? (
                  <View style={styles.logsEmpty}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="time-outline" size={23} color={C.pink} />
                    </View>
                    <Text style={styles.emptyCardTitle}>No period logs yet</Text>
                    <Text style={styles.emptyCardDescription}>
                      {viewerMode
                        ? 'Her period history will appear here once she logs a period.'
                        : 'Your saved period entries will appear here.'}
                    </Text>
                    {!viewerMode ? (
                      <Pressable
                        onPress={() => { setLogsModal(false); editPeriod(); }}
                        style={styles.outlineButton}
                      >
                        <Text style={styles.outlineButtonText}>Log a period</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.logsCard}>
                    {periods.map((period, index) => (
                      <View key={period.id} style={[styles.logRow, index < periods.length - 1 && styles.logRowBorder]}>
                        <View style={styles.logDateIcon}>
                          <Ionicons name="calendar-outline" size={19} color={C.pink} />
                        </View>
                        <View style={styles.logText}>
                          <Text style={styles.logTitle}>{formatDate(period.start_date)}</Text>
                          <Text style={styles.logSubtitle}>
                            {period.end_date
                              ? `Ended ${formatDate(period.end_date)}`
                              : period.start_date === latestPeriod?.start_date
                                ? 'Current or ongoing period'
                                : 'End date not recorded'}
                          </Text>
                        </View>
                        {!viewerMode && period.id !== 'shared-summary' ? (
                          <Pressable onPress={() => deleteOwnPeriod(period)} hitSlop={10} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Delete period log">
                            <Ionicons name="trash-outline" size={17} color={C.faint} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
                <Pressable onPress={() => setLogsModal(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* RELATIONSHIP NOTIFICATIONS MODAL */}
        <RelationshipNotificationModal
          visible={notifOpen}
          onClose={() => setNotifOpen(false)}
          viewerMode={viewerMode}
          partnerName={partnerName}
          dashboard={dashboard}
          onOpenCompose={(target) => openCompose(target || null)}
        />

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
                    <View style={styles.dailyChipWrap}>
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

function OverviewStat({
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
    <View style={styles.overviewStat}>
      <Ionicons name={icon} size={15} color={color} />
      <View style={styles.overviewStatCopy}>
        <Text style={styles.overviewStatLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.overviewStatValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  mainScroll: {
    flex: 1,
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

  /* Slim header */

  stickyHeader: {
    paddingHorizontal: 14,
    backgroundColor: '#FBF1F2',
    zIndex: 50,
  },

  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(138, 58, 80, 0.12)',
  },

  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTextGroup: {
    marginLeft: 6,
  },

  headerBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  headerBackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.2,
  },

  headerBell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  headerBellContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
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

  todayDateBlock: { paddingHorizontal: 4, marginTop: 2 },
  todayDateLabel: { color: C.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  todayDateValue: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 3 },

  dateStrip: {
    paddingTop: 10,
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

  /* Cycle overview (minimalist) */

  overviewHeading: {
    marginTop: 18,
    marginBottom: 8,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 0.1,
  },
  overviewCard: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  overviewStat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overviewStatCopy: { flexShrink: 1 },
  overviewStatLabel: { fontSize: 9, color: C.muted },
  overviewStatValue: { marginTop: 1, fontSize: 12, fontWeight: '700', color: C.text },
  predictionNote: { paddingHorizontal: 10, paddingBottom: 8, color: C.muted, fontSize: 10, lineHeight: 14 },
  fertilityNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingBottom: 9 },
  fertilityNoteText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 13 },
  overviewVDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.line,
  },
  overviewDivider: {
    height: 1,
    backgroundColor: C.line,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  overviewRowText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: C.text,
  },
  overviewSwitch: {
    transform: [{ scale: 0.75 }],
    marginRight: -6,
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

  dailyCaption: { color: C.muted, fontSize: 11, lineHeight: 16 },
  dailyLabel: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 5 },
  dailyChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  choiceChipActive: { backgroundColor: C.pinkSoft, borderColor: C.pink },
  choiceText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  choiceTextActive: { color: C.pink },
  dailyInput: { minHeight: 40, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 11, color: C.text, fontSize: 12 },
  dailyInputRow: { flexDirection: 'row', gap: 9 },
  dailySave: { borderRadius: 16, alignItems: 'center', padding: 12, backgroundColor: C.pink },
  dailySaveText: { color: C.white, fontSize: 12, fontWeight: '700' },
  dailyHistory: { color: C.muted, fontSize: 11, paddingVertical: 5, borderTopWidth: 1, borderTopColor: C.line },
  supplementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  takenButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  takenButtonActive: { backgroundColor: W.tileActive, borderColor: W.tileActiveBorder },
  statusOverlayRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  statusOverlayCard: { padding: 20, borderRadius: 24, backgroundColor: C.white, gap: 14, shadowColor: '#252238', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 8 },
  statusSuggestionWrap: { marginTop: 4 },
  wellnessSection: { marginTop: 8, gap: 8 },
  wellnessActions: { flexDirection: 'row', gap: 8 },
  wellnessAction: { flex: 1, minHeight: 76, paddingHorizontal: 7, paddingVertical: 7, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  wellnessActionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wellnessActionTitle: { color: C.text, fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  sharedWellnessValue: { color: W.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  cravingHistoryRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },

  /* Daily Wellness overlay (compact floating card) */

  wellSheet: {
    maxHeight: '68%',
    marginHorizontal: 12,
    backgroundColor: W.sheet,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#6B3A48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  wellHandle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: W.handle,
  },
  wellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  wellHeaderCenter: { flex: 1, alignItems: 'center' },
  wellClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  wellTitle: { fontSize: 19, fontWeight: '700', color: W.ink, letterSpacing: 0.1 },
  wellSubtitle: { marginTop: 2, fontSize: 12, color: W.inkSoft, textAlign: 'center' },
  wellScroll: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, gap: 9 },
  wellCard: {
    padding: 11,
    borderRadius: 18,
    backgroundColor: W.card,
    borderWidth: 1,
    borderColor: W.cardBorder,
    gap: 8,
  },
  wellCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wellCardIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: W.tileActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellCardTitle: { fontSize: 14, fontWeight: '700', color: W.ink },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moodTile: {
    width: '31.6%',
    flexGrow: 1,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: W.tile,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 3,
  },
  moodTileActive: { backgroundColor: W.tileActive, borderColor: W.tileActiveBorder },
  moodFace: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: W.face,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodFaceEmoji: { fontSize: 16 },
  moodLabel: { fontSize: 11, color: W.inkSoft, fontWeight: '500' },
  moodLabelActive: { color: W.ink, fontWeight: '700' },

  energyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  energyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: W.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyCircleActive: { backgroundColor: W.accentDeep },
  energyText: { fontSize: 16, color: W.ink, fontWeight: '500' },
  energyTextActive: { color: C.white, fontWeight: '700' },

  flowRow: { flexDirection: 'row', gap: 7 },
  flowPill: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: W.tile,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowPillActive: { backgroundColor: W.tileActive, borderColor: W.tileActiveBorder },
  flowText: { fontSize: 13, color: W.inkSoft, fontWeight: '500' },
  flowTextActive: { color: W.ink, fontWeight: '700' },

  wellSave: {
    height: 48,
    borderRadius: 24,
    backgroundColor: W.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wellSaveText: { color: C.white, fontSize: 14, fontWeight: '700' },

  wellChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: W.tile,
  },
  wellChipText: { fontSize: 12, color: W.ink, fontWeight: '600' },
  wellInput: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: W.cardBorder,
    backgroundColor: W.sheet,
    paddingHorizontal: 12,
    color: W.ink,
    fontSize: 13,
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

  logsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  logsModalTitleGroup: { flex: 1, paddingRight: 12 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.pinkSoft,
  },
  logsEmpty: {
    padding: 22,
    borderRadius: 20,
    alignItems: 'center',
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
