import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAccountState } from '../lib/account';
import {
    createPeriod,
    getPeriodDashboard,
    savePeriodSettings,
    updatePeriod,
} from '../lib/period';

const COLORS = {
  background: '#FDFDFB',
  charcoal: '#17181C',
  text: '#121217',
  muted: '#5B6470',
  faint: '#9AA1AC',
  pink: '#E5609F',
  pinkSoft: '#FCE8F1',
  blue: '#7FA2F2',
  blueSoft: '#EEF3FD',
  lavender: '#9690E1',
  border: '#C9D2E0',
  white: '#FFFFFF',
};

const SETUP_KEY_PREFIX = '@betweenus_period_setup_v1_';

const REGULARITY_OPTIONS = [
  {
    value: 'very_regular',
    label: 'Very regular',
    detail: 'Usually around the same time.',
  },
  {
    value: 'regular',
    label: 'Usually regular',
    detail: 'Small changes happen.',
  },
  {
    value: 'sometimes_irregular',
    label: 'Sometimes irregular',
    detail: 'It can shift noticeably.',
  },
  {
    value: 'often_irregular',
    label: 'Often irregular',
    detail: 'The timing changes a lot.',
  },
  {
    value: 'very_irregular',
    label: 'Very irregular',
    detail: 'Hard to predict from month to month.',
  },
] as const;

type Regularity = (typeof REGULARITY_OPTIONS)[number]['value'];

type PeriodLengthOption = {
  label: string;
  value: number;
};

const PERIOD_LENGTH_OPTIONS: PeriodLengthOption[] = [
  { label: '2–3 days', value: 3 },
  { label: '4–5 days', value: 5 },
  { label: '6–7 days', value: 7 },
  { label: '8+ days', value: 8 },
];

function todayString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizeDate(value: string) {
  return value.trim().replace(/\//g, '-');
}

function isValidDate(value: string, allowFuture = false) {
  const clean = normalizeDate(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return false;
  }

  const [year, month, day] = clean.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }

  if (!allowFuture && clean > todayString()) {
    return false;
  }

  return true;
}

function cycleLengthsFromDates(values: string[]) {
  const dates = values
    .filter((value) => isValidDate(value))
    .map(normalizeDate)
    .sort();

  const result: number[] = [];

  for (let i = 1; i < dates.length; i += 1) {
    const previous = new Date(`${dates[i - 1]}T12:00:00`);
    const current = new Date(`${dates[i]}T12:00:00`);

    const days = Math.round(
      (current.getTime() - previous.getTime()) / 86400000
    );

    if (days >= 15 && days <= 90) {
      result.push(days);
    }
  }

  return result;
}

function median(values: number[]) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function calculatePersonalizedCycleLength(
  history: string[],
  fallback: number
) {
  const lengths = cycleLengthsFromDates(history);

  if (lengths.length >= 2) {
    return median(lengths) ?? fallback;
  }

  if (lengths.length === 1) {
    return lengths[0];
  }

  return fallback;
}

function getConfidence(
  history: string[],
  regularity: Regularity
) {
  const lengths = cycleLengthsFromDates(history);
  const variation = lengths.length
    ? Math.max(...lengths) - Math.min(...lengths)
    : Number.POSITIVE_INFINITY;

  if (
    lengths.length >= 4 &&
    variation <= 3 &&
    (regularity === 'very_regular' || regularity === 'regular')
  ) {
    return 'High';
  }

  if (
    lengths.length >= 2 &&
    variation <= 7 &&
    regularity !== 'very_irregular' &&
    regularity !== 'often_irregular'
  ) {
    return 'Moderate';
  }

  return 'Building';
}

function getSetupKey(userId: string | null | undefined) {
  return userId
    ? `${SETUP_KEY_PREFIX}${userId}`
    : `${SETUP_KEY_PREFIX}local`;
}

export default function PeriodSetupScreen() {
  const [checkingRole, setCheckingRole] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<
    'last' | 'lastEnd' | number | null
  >(null);

  const [lastPeriod, setLastPeriod] = useState('');
  const [lastPeriodEnd, setLastPeriodEnd] = useState('');
  const [periodLength, setPeriodLength] = useState(5);
  const [regularity, setRegularity] =
    useState<Regularity>('sometimes_irregular');
  const [typicalCycleLength, setTypicalCycleLength] =
    useState('28');
  const [history, setHistory] = useState([
    '',
    '',
    '',
    '',
    '',
  ]);

  /*
   * IMPORTANT:
   * Period setup belongs only to the girlfriend account.
   *
   * This prevents a boyfriend account from accidentally
   * creating period settings/logs under his own user_id.
   */
  useEffect(() => {
    let mounted = true;

    async function checkRole() {
      try {
        const account = await getAccountState();

        if (!mounted) {
          return;
        }

        if (!account || account.status === 'new') {
          router.replace('/');
          return;
        }

        if (account.role !== 'girlfriend') {
          Alert.alert(
            'Girlfriend only',
            'Period setup belongs to the girlfriend account. Your partner can view the shared cycle from their own account.'
          );

          router.replace('/boyfriend');
          return;
        }
      } catch (error) {
        console.error(
          'PERIOD SETUP ROLE CHECK:',
          error
        );

        router.replace('/home');
      } finally {
        if (mounted) {
          setCheckingRole(false);
        }
      }
    }

    checkRole();

    return () => {
      mounted = false;
    };
  }, []);

  const historyDates = useMemo(() => {
    const dates = [
      lastPeriod,
      ...history,
    ]
      .map(normalizeDate)
      .filter(Boolean);

    return Array.from(new Set(dates));
  }, [lastPeriod, history]);

  const calculatedCycleLength = useMemo(() => {
    const fallback = Math.min(
      60,
      Math.max(
        15,
        Number(typicalCycleLength) || 28
      )
    );

    return calculatePersonalizedCycleLength(
      historyDates,
      fallback
    );
  }, [
    historyDates,
    typicalCycleLength,
  ]);

  const confidence = useMemo(
    () =>
      getConfidence(
        historyDates,
        regularity
      ),
    [historyDates, regularity]
  );

  const totalSteps = 7;

  function next() {
    if (step === 1) {
      if (!isValidDate(lastPeriod)) {
        Alert.alert(
          'Check the date',
          'Choose the first day of your most recent period from the calendar.'
        );

        return;
      }

      if (
        lastPeriodEnd &&
        (!isValidDate(lastPeriodEnd) || normalizeDate(lastPeriodEnd) < normalizeDate(lastPeriod))
      ) {
        Alert.alert(
          'Check the end date',
          'The end date must be the same day as or later than the start date.'
        );
        return;
      }
    }

    if (step === 4) {
      const invalid = history.some(
        (value) =>
          value.trim() &&
          !isValidDate(value)
      );

      if (invalid) {
        Alert.alert(
          'Check your dates',
          'Choose a valid calendar date for each previous period you remember.'
        );

        return;
      }
    }

    setStep((value) =>
      Math.min(
        totalSteps - 1,
        value + 1
      )
    );
  }

  function back() {
    if (step === 0) {
      router.back();
      return;
    }

    setStep((value) =>
      Math.max(0, value - 1)
    );
  }

  function updateHistory(
    index: number,
    value: string
  ) {
    setHistory((current) => {
      const nextValues = [...current];

      nextValues[index] = value;

      return nextValues;
    });
  }

  async function finish() {
    if (!isValidDate(lastPeriod)) {
      Alert.alert(
        'Missing date',
        'Please choose your most recent period start date from the calendar.'
      );

      setStep(1);
      return;
    }

    if (
      lastPeriodEnd &&
      (!isValidDate(lastPeriodEnd) || normalizeDate(lastPeriodEnd) < normalizeDate(lastPeriod))
    ) {
      Alert.alert(
        'Check the end date',
        'The end date must be the same day as or later than the start date.'
      );
      setStep(1);
      return;
    }

    const account = await getAccountState();

    /*
     * SECOND SAFETY CHECK.
     *
     * Even if somebody somehow reaches this function
     * without passing the initial role check, the data
     * still cannot be saved from a boyfriend account.
     */
    if (!account || account.status === 'new') {
      router.replace('/');
      return;
    }

    if (account.role !== 'girlfriend') {
      Alert.alert(
        'Girlfriend only',
        'Only the girlfriend account can create or edit period data.'
      );

      router.replace('/boyfriend');
      return;
    }

    const cleanedHistory = Array.from(
      new Set(
        [
          lastPeriod,
          ...history,
        ]
          .map(normalizeDate)
          .filter((value) =>
            isValidDate(value)
          )
      )
    ).sort();

    const setupKey = getSetupKey(
      account.user_id
    );

    try {
      setSaving(true);

      const existing =
        await getPeriodDashboard();

      for (const date of cleanedHistory) {
        const existingPeriod = existing.own.periods.find(
          (period) => period.start_date === date
        );
        const isMostRecent = date === normalizeDate(lastPeriod);
        const endDate = isMostRecent && lastPeriodEnd
          ? normalizeDate(lastPeriodEnd)
          : null;

        if (!existingPeriod) {
          await createPeriod(date, endDate, '');
        } else if (existingPeriod && endDate && existingPeriod.end_date !== endDate) {
          await updatePeriod(
            existingPeriod.id,
            existingPeriod.start_date,
            endDate,
            existingPeriod.notes || ''
          );
        }
      }

      const selectedCycle = Math.min(
        60,
        Math.max(
          15,
          calculatedCycleLength
        )
      );

      await savePeriodSettings({
        tracking_enabled: true,
        average_cycle_length:
          selectedCycle,
        average_period_length:
          periodLength,
      });

      await AsyncStorage.setItem(
        setupKey,
        JSON.stringify({
          version: 1,
          completedAt:
            new Date().toISOString(),
          regularity,
          confidence,
          historyCount:
            cleanedHistory.length,
        })
      );

      router.replace('/period');
    } catch (error: any) {
      console.error(
        'PERIOD SETUP:',
        error
      );

      Alert.alert(
        'Could not finish setup',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingRole) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom']}
      >
        <View style={styles.roleLoading}>
          <ActivityIndicator
            color={COLORS.pink}
            size="small"
          />

          <Text
            style={
              styles.roleLoadingText
            }
          >
            Checking your account…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={back}
            hitSlop={12}
            style={({ pressed }) => [
              styles.iconButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Feather
              name="arrow-left"
              size={20}
              color={COLORS.text}
            />
          </Pressable>

          <View
            style={
              styles.progressTrack
            }
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((step + 1) /
                      totalSteps) *
                    100
                  }%`,
                },
              ]}
            />
          </View>

          <Text
            style={
              styles.progressText
            }
          >
            {step + 1}/{totalSteps}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={
            styles.container
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <StepShell
              eyebrow="LET’S PERSONALIZE IT"
              title="Let’s understand your cycle."
              subtitle="A few questions help Between Us make more personal estimates instead of assuming a standard 28-day cycle."
              icon="heart"
              iconColor={COLORS.pink}
            >
              <InfoNote>
                Your answers stay private unless you choose to share cycle information with your partner.
              </InfoNote>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              eyebrow="01 · MOST RECENT PERIOD"
              title="When did your most recent period start?"
              subtitle="Use the first day of actual bleeding, not the day it ended."
              icon="calendar"
              iconColor={COLORS.pink}
            >
              <DatePickerField
                value={lastPeriod}
                placeholder="Choose your most recent start date"
                onPress={() => setDatePickerTarget('last')}
              />
              <View style={styles.optionalDateBlock}>
                <View style={styles.optionalDateHeading}>
                  <Text style={styles.optionalDateTitle}>When did it end?</Text>
                  <Text style={styles.optionalTag}>OPTIONAL</Text>
                </View>
                <Text style={styles.optionalDateHint}>If you remember, this helps match the period phase to your actual dates. Leave it blank if you’re unsure.</Text>
                <DatePickerField
                  value={lastPeriodEnd}
                  placeholder="Choose the last day of bleeding"
                  onPress={() => setDatePickerTarget('lastEnd')}
                  onClear={() => setLastPeriodEnd('')}
                />
              </View>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              eyebrow="02 · PERIOD LENGTH"
              title="About how long does your period usually last?"
              subtitle="Pick the closest answer. We can refine this later as you log real periods."
              icon="droplet"
              iconColor={COLORS.pink}
            >
              <View
                style={
                  styles.optionList
                }
              >
                {PERIOD_LENGTH_OPTIONS.map(
                  (option) => (
                    <Choice
                      key={
                        option.value
                      }
                      label={
                        option.label
                      }
                      selected={
                        periodLength ===
                        option.value
                      }
                      onPress={() =>
                        setPeriodLength(
                          option.value
                        )
                      }
                    />
                  )
                )}
              </View>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              eyebrow="03 · REGULARITY"
              title="How predictable is your cycle?"
              subtitle="Be honest here. Irregularity is useful information—it helps us avoid overconfident predictions."
              icon="activity"
              iconColor={
                COLORS.lavender
              }
            >
              <View
                style={
                  styles.optionList
                }
              >
                {REGULARITY_OPTIONS.map(
                  (option) => (
                    <Choice
                      key={
                        option.value
                      }
                      label={
                        option.label
                      }
                      detail={
                        option.detail
                      }
                      selected={
                        regularity ===
                        option.value
                      }
                      onPress={() =>
                        setRegularity(
                          option.value
                        )
                      }
                    />
                  )
                )}
              </View>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              eyebrow="04 · YOUR HISTORY"
              title="Do you remember previous period starts?"
              subtitle="More history makes the estimate more personal. You can leave anything blank if you do not remember."
              icon="clock"
              iconColor={COLORS.blue}
            >
              <View
                style={
                  styles.historyCard
                }
              >
                <Text
                  style={
                    styles.historyTitle
                  }
                >
                  Previous starts
                </Text>

                {history.map(
                  (
                    value,
                    index
                  ) => (
                    <DatePickerField
                      key={index}
                      value={value}
                      placeholder={`Choose previous start ${index + 1}`}
                      onPress={() => setDatePickerTarget(index)}
                      onClear={() => updateHistory(index, '')}
                    />
                  )
                )}
              </View>

              <InfoNote>
                If your cycle is irregular, these dates are especially valuable because we can calculate your actual cycle-to-cycle variation.
              </InfoNote>
            </StepShell>
          )}

          {step === 5 && (
            <StepShell
              eyebrow="05 · CYCLE BASELINE"
              title="What is your usual cycle length?"
              subtitle="This is only a starting point. If you gave us enough history, your actual logged cycles will take priority."
              icon="repeat"
              iconColor={COLORS.blue}
            >
              <View
                style={
                  styles.numberInputWrap
                }
              >
                <TextInput
                  value={
                    typicalCycleLength
                  }
                  onChangeText={(
                    value
                  ) =>
                    setTypicalCycleLength(
                      value.replace(
                        /\D/g,
                        ''
                      )
                    )
                  }
                  keyboardType="number-pad"
                  maxLength={2}
                  style={
                    styles.numberInput
                  }
                  placeholder="28"
                  placeholderTextColor={
                    COLORS.faint
                  }
                />

                <Text
                  style={
                    styles.daysLabel
                  }
                >
                  days
                </Text>
              </View>

              <View
                style={
                  styles.estimateCard
                }
              >
                <View
                  style={
                    styles.estimateTop
                  }
                >
                  <Text
                    style={
                      styles.estimateEyebrow
                    }
                  >
                    PERSONALIZED BASELINE
                  </Text>

                  <Feather
                    name="star"
                    size={17}
                    color={COLORS.pink}
                  />
                </View>

                <Text
                  style={
                    styles.estimateValue
                  }
                >
                  {
                    calculatedCycleLength
                  }{' '}
                  days
                </Text>

                <Text
                  style={
                    styles.estimateDescription
                  }
                >
                  {historyDates.length >=
                  3
                    ? `Calculated from ${historyDates.length} period start dates using your actual cycle history.`
                    : 'We will refine this automatically as more periods are logged.'}
                </Text>
              </View>
            </StepShell>
          )}

          {step === 6 && (
            <StepShell
              eyebrow="06 · READY TO TRACK"
              title="Your cycle setup is ready."
              subtitle="Your partner can view the shared cycle from their account."
              icon="lock"
              iconColor={
                COLORS.lavender
              }
            >
              <View
                style={
                  styles.readyCard
                }
              >
                <Text
                  style={
                    styles.readyEyebrow
                  }
                >
                  YOUR FIRST ESTIMATE
                </Text>

                <Text
                  style={
                    styles.readyTitle
                  }
                >
                  Your cycle model is
                  ready to learn.
                </Text>

                <Text
                  style={
                    styles.readyText
                  }
                >
                  {historyDates.length >=
                  3
                    ? `We have ${historyDates.length} period starts to work with. Current confidence: ${confidence}.`
                    : `We are starting with your baseline and will become more accurate as you log more periods. Current confidence: ${confidence}.`}
                </Text>
              </View>
            </StepShell>
          )}
        </ScrollView>

        <View
          style={styles.bottomBar}
        >
          {step <
          totalSteps - 1 ? (
            <Pressable
              onPress={next}
              style={({
                pressed,
              }) => [
                styles.primaryButton,
                pressed &&
                  styles.primaryPressed,
              ]}
            >
              <Text
                style={
                  styles.primaryText
                }
              >
                {step === 0
                  ? 'Start setup'
                  : 'Continue'}
              </Text>

              <Feather
                name="arrow-right"
                size={20}
                color={COLORS.white}
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={finish}
              disabled={saving}
              style={({
                pressed,
              }) => [
                styles.primaryButton,
                pressed &&
                  !saving &&
                  styles.primaryPressed,
                saving &&
                  styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator
                  color={
                    COLORS.white
                  }
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.primaryText
                    }
                  >
                    Finish setup
                  </Text>

                  <Feather
                    name="check"
                    size={20}
                    color={
                      COLORS.white
                    }
                  />
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
      <PeriodDatePicker
        key={`${datePickerTarget ?? 'closed'}-${datePickerTarget === 'last'
          ? lastPeriod
          : datePickerTarget === 'lastEnd'
            ? lastPeriodEnd
          : typeof datePickerTarget === 'number'
            ? history[datePickerTarget]
            : ''}`}
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'last'
          ? lastPeriod
          : datePickerTarget === 'lastEnd'
            ? lastPeriodEnd
          : typeof datePickerTarget === 'number'
            ? history[datePickerTarget]
            : ''}
        minDate={datePickerTarget === 'lastEnd' && lastPeriod ? normalizeDate(lastPeriod) : undefined}
        onClose={() => setDatePickerTarget(null)}
        onSelect={(value) => {
          if (datePickerTarget === 'last') {
            setLastPeriod(value);
            if (lastPeriodEnd && normalizeDate(lastPeriodEnd) < value) {
              setLastPeriodEnd('');
            }
          } else if (datePickerTarget === 'lastEnd') {
            setLastPeriodEnd(value);
          } else if (typeof datePickerTarget === 'number') {
            updateHistory(datePickerTarget, value);
          }
          setDatePickerTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  icon,
  iconColor,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  children: ReactNode;
}) {
  return (
    <View
      style={styles.stepShell}
    >
      <View
        style={[
          styles.stepIcon,
          {
            backgroundColor:
              `${iconColor}18`,
          },
        ]}
      >
        <Feather
          name={icon}
          size={21}
          color={iconColor}
        />
      </View>

      <Text
        style={styles.eyebrow}
      >
        {eyebrow}
      </Text>

      <Text
        style={styles.title}
      >
        {title}
      </Text>

      <Text
        style={styles.subtitle}
      >
        {subtitle}
      </Text>

      <View
        style={styles.content}
      >
        {children}
      </View>
    </View>
  );
}

function Choice({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({
        pressed,
      }) => [
        styles.choice,
        selected &&
          styles.choiceSelected,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={styles.choiceText}
      >
        <Text
          style={[
            styles.choiceLabel,
            selected &&
              styles.choiceLabelSelected,
          ]}
        >
          {label}
        </Text>

        {detail ? (
          <Text
            style={
              styles.choiceDetail
            }
          >
            {detail}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={styles.radioDot}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function formatDateLabel(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function DatePickerField({
  value,
  placeholder,
  onPress,
  onClear,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <View style={styles.dateFieldWrap}>
      <Feather
        name="calendar"
        size={18}
        color={COLORS.pink}
      />
      <Pressable onPress={onPress} style={styles.dateFieldButton} accessibilityRole="button">
        <Text style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]}>
          {value ? formatDateLabel(value) : placeholder}
        </Text>
      </Pressable>
      {value && onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear date">
          <Feather name="x-circle" size={18} color={COLORS.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PeriodDatePicker({
  visible,
  value,
  minDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  minDate?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const today = todayString();
  const [shownMonth, setShownMonth] = useState(value.slice(0, 7) || today.slice(0, 7));

  const [year, month] = shownMonth.split('-').map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? '' : String(index - firstWeekday + 1).padStart(2, '0')
  );
  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });
  const canGoForward = shownMonth < today.slice(0, 7);

  const changeMonth = (amount: number) => {
    const date = new Date(year, month - 1 + amount, 1);
    setShownMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.calendarOverlay}>
        <Pressable style={styles.calendarBackdrop} onPress={onClose} />
        <View style={styles.calendarSheet}>
          <View style={styles.calendarTopRow}>
            <Text style={styles.calendarTitle}>Choose a date</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close calendar">
              <Feather name="x" size={22} color={COLORS.muted} />
            </Pressable>
          </View>
          <View style={styles.calendarMonthRow}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.calendarArrow} accessibilityLabel="Previous month">
              <Feather name="chevron-left" size={20} color={COLORS.text} />
            </Pressable>
            <Text style={styles.calendarMonth}>{monthTitle}</Text>
            <Pressable onPress={() => canGoForward && changeMonth(1)} style={styles.calendarArrow} disabled={!canGoForward} accessibilityLabel="Next month">
              <Feather name="chevron-right" size={20} color={canGoForward ? COLORS.text : COLORS.border} />
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.calendarWeekday}>{day}</Text>
            ))}
            {days.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.calendarCell} />;
              const dateValue = `${shownMonth}-${day}`;
              const disabled = dateValue > today || (!!minDate && dateValue < minDate);
              const selected = dateValue === value;
              return (
                <Pressable
                  key={dateValue}
                  disabled={disabled}
                  onPress={() => onSelect(dateValue)}
                  style={[styles.calendarCell, selected && styles.calendarSelectedCell]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={formatDateLabel(dateValue)}
                >
                  <Text style={[styles.calendarDay, selected && styles.calendarSelectedDay, disabled && styles.calendarDisabledDay]}>{Number(day)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.calendarHint}>{minDate ? 'Choose the last day of bleeding. Dates before the start are unavailable.' : 'Select the first day of bleeding. Future dates are unavailable.'}</Text>
        </View>
      </View>
    </Modal>
  );
}

function InfoNote({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <View
      style={styles.infoNote}
    >
      <Feather
        name="info"
        size={17}
        color={COLORS.blue}
      />

      <Text
        style={styles.infoText}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safe: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  roleLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  roleLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.muted,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor:
      COLORS.white,
  },

  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor:
      '#E9EDF3',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor:
      COLORS.pink,
  },

  progressText: {
    width: 34,
    textAlign: 'right',
    fontSize: 12,
    color: COLORS.faint,
    fontWeight: '600',
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },

  stepShell: {
    paddingTop: 4,
  },

  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: '700',
    color: COLORS.faint,
    marginBottom: 10,
  },

  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '500',
    letterSpacing: -0.8,
    color: COLORS.text,
    maxWidth: 350,
  },

  subtitle: {
    marginTop: 13,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '300',
    color: COLORS.muted,
    maxWidth: 355,
  },

  content: {
    marginTop: 28,
  },

  optionList: {
    gap: 10,
  },

  choice: {
    minHeight: 66,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor:
      COLORS.white,
    paddingHorizontal: 17,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  choiceSelected: {
    borderColor: '#E9A8C5',
    backgroundColor:
      COLORS.pinkSoft,
  },

  choiceText: {
    flex: 1,
    paddingRight: 12,
  },

  choiceLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },

  choiceLabelSelected: {
    color: '#9C416A',
  },

  choiceDetail: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.muted,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor:
      COLORS.pink,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor:
      COLORS.pink,
  },

  inputWrap: {
    minHeight: 58,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor:
      COLORS.white,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },

  dateFieldWrap: {
    minHeight: 58,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },

  optionalDateBlock: {
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFF9FB',
    borderWidth: 1,
    borderColor: '#F6E4EB',
  },
  optionalDateHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionalDateTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  optionalTag: { color: COLORS.pink, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  optionalDateHint: { marginBottom: 9, color: COLORS.muted, fontSize: 11, lineHeight: 16 },

  dateFieldButton: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
  },

  dateFieldText: {
    fontSize: 15,
    color: COLORS.text,
  },

  dateFieldPlaceholder: {
    color: COLORS.faint,
  },

  calendarOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  calendarBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 18, 23, 0.35)',
  },

  calendarSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },

  calendarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  calendarTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: COLORS.text,
  },

  calendarMonthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  calendarArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarWeekday: {
    width: '14.2857%',
    height: 36,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.faint,
  },

  calendarCell: {
    width: '14.2857%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarSelectedCell: {
    borderRadius: 22,
    backgroundColor: COLORS.pink,
  },

  calendarDay: {
    fontSize: 14,
    color: COLORS.text,
  },

  calendarSelectedDay: {
    color: COLORS.white,
    fontWeight: '700',
  },

  calendarDisabledDay: {
    color: '#D3D7DE',
  },

  calendarHint: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.faint,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 12,
  },

  helper: {
    marginTop: 1,
    fontSize: 12,
    color: COLORS.faint,
  },

  historyCard: {
    borderRadius: 24,
    backgroundColor:
      COLORS.blueSoft,
    borderWidth: 1,
    borderColor:
      '#D9E2F5',
    padding: 16,
  },

  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 12,
  },

  numberInputWrap: {
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor:
      COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  numberInput: {
    flex: 1,
    fontSize: 30,
    fontWeight: '500',
    color: COLORS.text,
  },

  daysLabel: {
    fontSize: 16,
    color: COLORS.muted,
  },

  estimateCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 19,
  },

  estimateTop: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  estimateEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: COLORS.faint,
  },

  estimateValue: {
    marginTop: 8,
    fontSize: 31,
    fontWeight: '500',
    letterSpacing: -0.7,
    color: COLORS.text,
  },

  estimateDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },

  readyCard: {
    marginTop: 20,
    borderRadius: 25,
    backgroundColor:
      COLORS.pinkSoft,
    borderWidth: 1,
    borderColor: '#F2CBDC',
    padding: 20,
  },

  readyEyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: '#A34E74',
  },

  readyTitle: {
    marginTop: 9,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '500',
    color: COLORS.text,
  },

  readyText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
  },

  infoNote: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor:
      COLORS.blueSoft,
    borderWidth: 1,
    borderColor:
      '#D8E1F3',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },

  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor:
      COLORS.background,
  },

  primaryButton: {
    height: 60,
    borderRadius: 30,
    backgroundColor:
      COLORS.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  primaryText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '600',
  },

  primaryPressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.75,
  },
});
