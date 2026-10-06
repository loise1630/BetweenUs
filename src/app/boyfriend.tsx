import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import {
    useCallback,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    getAccountState,
    type AccountState,
} from '../lib/account';

import {
    getCurrentCycleInfo,
    getPeriodDashboard,
    type CyclePhase,
    type PeriodDashboard,
} from '../lib/period';

// ============================================================
// THEME
// Based on the Between Us landing-screen style
// ============================================================

const COLORS = {
  background: '#FDFDFB',
  white: '#FFFFFF',

  charcoal: '#17181C',
  text: '#25262B',
  muted: '#6B7280',
  faint: '#9AA1AC',

  pink: '#E5609F',
  pinkSoft: '#FCE8F1',
  pinkBorder: '#F2D3E1',

  blue: '#7FA2F2',
  blueSoft: '#EEF3FD',
  blueBorder: '#D9E4FA',

  lavender: '#9690E1',
  lavenderSoft: '#F1F0FC',

  green: '#72A88A',
  greenSoft: '#ECF6F0',

  orange: '#D99A62',
  orangeSoft: '#FFF3E7',

  border: '#C9D2E0',
  softBorder: '#E8EBF0',

  danger: '#C96C7F',
};

// ============================================================
// HELPERS
// ============================================================

function todayString() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    now.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  const date = parseDate(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
}

function formatShortDate(
  value: string | null | undefined
) {
  if (!value) {
    return '—';
  }

  const date = parseDate(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    }
  );
}

function addDays(
  value: string,
  amount: number
) {
  const date = parseDate(value);

  date.setDate(
    date.getDate() + amount
  );

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function daysBetween(
  start: string,
  end: string
) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const difference =
    endDate.getTime() -
    startDate.getTime();

  return Math.round(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

function phaseColor(
  phase: CyclePhase | null
) {
  switch (phase) {
    case 'Period':
      return COLORS.pink;

    case 'Follicular':
      return COLORS.orange;

    case 'Ovulation':
      return COLORS.blue;

    case 'Luteal':
      return COLORS.lavender;

    default:
      return COLORS.muted;
  }
}

function phaseBackground(
  phase: CyclePhase | null
) {
  switch (phase) {
    case 'Period':
      return COLORS.pinkSoft;

    case 'Follicular':
      return COLORS.orangeSoft;

    case 'Ovulation':
      return COLORS.blueSoft;

    case 'Luteal':
      return COLORS.lavenderSoft;

    default:
      return '#F4F5F7';
  }
}

function phaseIcon(
  phase: CyclePhase | null
) {
  switch (phase) {
    case 'Period':
      return 'droplet';

    case 'Follicular':
      return 'sun';

    case 'Ovulation':
      return 'sparkles';

    case 'Luteal':
      return 'moon';

    default:
      return 'activity';
  }
}

function phaseDescription(
  phase: CyclePhase | null
) {
  switch (phase) {
    case 'Period':
      return 'Period phase';

    case 'Follicular':
      return 'Energy may gradually rise';

    case 'Ovulation':
      return 'Estimated fertile window';

    case 'Luteal':
      return 'The body is preparing for the next period';

    default:
      return 'Cycle phase is being estimated';
  }
}

// ============================================================
// CALENDAR
// ============================================================

type CalendarDay = {
  date: string;
  day: number;
  currentMonth: boolean;
};

function buildCalendarDays(
  month: Date
): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDay = new Date(
    year,
    monthIndex,
    1
  );

  const lastDay = new Date(
    year,
    monthIndex + 1,
    0
  );

  const firstWeekday =
    firstDay.getDay();

  const daysInMonth =
    lastDay.getDate();

  const result: CalendarDay[] = [];

  for (
    let index = firstWeekday - 1;
    index >= 0;
    index--
  ) {
    const date = new Date(
      year,
      monthIndex,
      -index
    );

    result.push({
      date: toDateString(date),
      day: date.getDate(),
      currentMonth: false,
    });
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const date = new Date(
      year,
      monthIndex,
      day
    );

    result.push({
      date: toDateString(date),
      day,
      currentMonth: true,
    });
  }

  let nextDay = 1;

  while (
    result.length % 7 !== 0
  ) {
    const date = new Date(
      year,
      monthIndex + 1,
      nextDay
    );

    result.push({
      date: toDateString(date),
      day: date.getDate(),
      currentMonth: false,
    });

    nextDay++;
  }

  return result;
}

function toDateString(
  date: Date
) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// ============================================================
// SCREEN
// ============================================================

export default function BoyfriendScreen() {
  // ----------------------------------------------------------
  // IMPORTANT:
  // ALL HOOKS ARE DECLARED BEFORE ANY RETURN.
  // This fixes the React "Rendered more hooks..." error.
  // ----------------------------------------------------------

  const [account, setAccount] =
    useState<AccountState | null>(
      null
    );

  const [dashboard, setDashboard] =
    useState<PeriodDashboard | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [month, setMonth] =
    useState(new Date());

  // ----------------------------------------------------------
  // LOAD
  // ----------------------------------------------------------

  const load = useCallback(
    async () => {
      try {
        setErrorMessage(null);

        const state =
          await getAccountState();

        setAccount(state);

        const data =
          await getPeriodDashboard();

        setDashboard(data);
      } catch (error: any) {
        console.error(
          'BOYFRIEND PERIOD LOAD:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Unable to load cycle information.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ==========================================================
  // DERIVED VALUES
  // NO HOOKS BELOW THIS POINT.
  // ==========================================================

  const today = todayString();

  const members =
    account?.members || [];

  const girlfriend =
    members.find(
      (member: any) =>
        member.role === 'girlfriend'
    );

  const girlfriendName =
    girlfriend?.name ||
    'Her';

  /*
   * getPeriodDashboard() returns the current user's
   * own data plus partner data.
   *
   * We intentionally read partner data defensively here
   * so this screen keeps working even if the RPC returns
   * slightly different nullable shapes.
   */
  const rawDashboard =
    dashboard as any;

  const partnerData =
    rawDashboard?.partner ??
    rawDashboard?.partner_period ??
    rawDashboard?.partner_period_data ??
    null;

  const partnerSettings =
    partnerData?.settings ??
    partnerData?.period_settings ??
    null;

  const partnerPeriods =
    Array.isArray(
      partnerData?.periods
    )
      ? partnerData.periods
      : [];

  const partnerSymptoms =
    Array.isArray(
      partnerData?.symptoms
    )
      ? partnerData.symptoms
      : [];

  const visibility =
    partnerSettings?.partner_visibility ??
    'private';

  // ----------------------------------------------------------
  // CURRENT CYCLE
  // ----------------------------------------------------------

  let currentCycle: any = null;

  if (
    partnerPeriods.length > 0
  ) {
    try {
      currentCycle =
        getCurrentCycleInfo(
          partnerPeriods,
          partnerSettings
        );
    } catch (error) {
      console.error(
        'CYCLE CALCULATION ERROR:',
        error
      );
    }
  }

  const currentPhase =
    currentCycle?.phase ??
    null;

  const cycleDay =
    currentCycle?.cycleDay ??
    null;

  const cycleLength =
    currentCycle?.cycleLength ??
    partnerSettings?.average_cycle_length ??
    null;

  const nextPeriod =
    currentCycle?.predictedNextPeriod ??
    currentCycle?.nextPeriod ??
    null;

  const latestPeriod =
    currentCycle?.latestPeriod ??
    null;

  // ----------------------------------------------------------
  // IF HELPER DOES NOT RETURN PREDICTED DATE,
  // CALCULATE A BASIC ESTIMATE FROM THE LATEST PERIOD.
  // ----------------------------------------------------------

  let estimatedNextPeriod =
    nextPeriod;

  if (
    !estimatedNextPeriod &&
    latestPeriod?.start_date &&
    cycleLength
  ) {
    estimatedNextPeriod =
      addDays(
        latestPeriod.start_date,
        Number(cycleLength)
      );
  }

  // ----------------------------------------------------------
  // CALENDAR
  // ----------------------------------------------------------

  const calendarDays =
    buildCalendarDays(month);

  const monthTitle =
    month.toLocaleDateString(
      undefined,
      {
        month: 'long',
        year: 'numeric',
      }
    );

  // ----------------------------------------------------------
  // PERIOD DATE RANGE
  // ----------------------------------------------------------

  const periodLength =
    Number(
      partnerSettings?.average_period_length ??
        5
    );

  function isPeriodDate(
    date: string
  ) {
    if (
      partnerPeriods.length === 0
    ) {
      return false;
    }

    return partnerPeriods.some(
      (period: any) => {
        if (!period?.start_date) {
          return false;
        }

        const start =
          period.start_date;

        const end =
          period.end_date ||
          addDays(
            start,
            Math.max(
              periodLength - 1,
              0
            )
          );

        return (
          date >= start &&
          date <= end
        );
      }
    );
  }

  // ----------------------------------------------------------
  // ESTIMATED OVULATION
  // ----------------------------------------------------------

  let estimatedOvulation:
    string | null = null;

  if (
    latestPeriod?.start_date &&
    cycleLength
  ) {
    const ovulationOffset =
      Math.max(
        Number(cycleLength) - 14,
        0
      );

    estimatedOvulation =
      addDays(
        latestPeriod.start_date,
        ovulationOffset
      );
  }

  // ----------------------------------------------------------
  // FERTILE WINDOW
  // ----------------------------------------------------------

  let fertileStart:
    string | null = null;

  let fertileEnd:
    string | null = null;

  if (estimatedOvulation) {
    fertileStart =
      addDays(
        estimatedOvulation,
        -5
      );

    fertileEnd =
      addDays(
        estimatedOvulation,
        1
      );
  }

  function isFertileDate(
    date: string
  ) {
    if (
      !fertileStart ||
      !fertileEnd
    ) {
      return false;
    }

    return (
      date >= fertileStart &&
      date <= fertileEnd
    );
  }

  function isOvulationDate(
    date: string
  ) {
    return (
      estimatedOvulation ===
      date
    );
  }

  // ----------------------------------------------------------
  // TODAY'S SHARED SYMPTOMS
  // ----------------------------------------------------------

  const todaySymptoms =
    partnerSymptoms.filter(
      (symptom: any) =>
        symptom?.symptom_date ===
        today
    );

  // ==========================================================
  // MONTH NAVIGATION
  // ==========================================================

  function previousMonth() {
    setMonth(
      current => {
        const next =
          new Date(current);

        next.setMonth(
          next.getMonth() - 1
        );

        return next;
      }
    );
  }

  function nextMonth() {
    setMonth(
      current => {
        const next =
          new Date(current);

        next.setMonth(
          next.getMonth() + 1
        );

        return next;
      }
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="small"
          color={COLORS.pink}
        />

        <Text
          style={styles.loadingText}
        >
          Loading her cycle...
        </Text>
      </View>
    );
  }

  // ==========================================================
  // ACCOUNT ERROR
  // ==========================================================

  if (!account) {
    return (
      <View style={styles.center}>
        <View
          style={styles.errorIcon}
        >
          <Feather
            name="alert-circle"
            size={24}
            color={COLORS.danger}
          />
        </View>

        <Text
          style={styles.errorTitle}
        >
          Unable to load account
        </Text>

        <Text
          style={styles.errorText}
        >
          {errorMessage ||
            'Please try again.'}
        </Text>

        <Pressable
          onPress={load}
          style={styles.primaryButton}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  // ==========================================================
  // PRIVATE
  // ==========================================================

  if (
    visibility === 'private'
  ) {
    return (
      <View
        style={styles.screen}
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.container
          }
        >
          <View
            style={styles.header}
          >
            <Pressable
              onPress={() =>
                router.back()
              }
              style={
                styles.headerButton
              }
            >
              <Feather
                name="chevron-left"
                size={22}
                color={
                  COLORS.charcoal
                }
              />
            </Pressable>

            <View
              style={
                styles.headerCenter
              }
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                HER CYCLE
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Period Cycle
              </Text>
            </View>

            <View
              style={
                styles.headerButtonPlaceholder
              }
            />
          </View>

          <View
            style={styles.privateCard}
          >
            <View
              style={
                styles.privateIcon
              }
            >
              <Feather
                name="lock"
                size={22}
                color={
                  COLORS.pink
                }
              />
            </View>

            <Text
              style={
                styles.privateTitle
              }
            >
              Her cycle is private
            </Text>

            <Text
              style={
                styles.privateText
              }
            >
              {girlfriendName} has chosen
              not to share her period
              information with you.
            </Text>

            <View
              style={
                styles.privateDivider
              }
            />

            <Text
              style={
                styles.privateHint
              }
            >
              She can change this anytime
              from her Period Tracker privacy
              settings.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ==========================================================
  // NO PARTNER DATA
  // ==========================================================

  if (
    !partnerSettings &&
    partnerPeriods.length === 0
  ) {
    return (
      <View
        style={styles.screen}
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.container
          }
        >
          <View
            style={styles.header}
          >
            <Pressable
              onPress={() =>
                router.back()
              }
              style={
                styles.headerButton
              }
            >
              <Feather
                name="chevron-left"
                size={22}
                color={
                  COLORS.charcoal
                }
              />
            </Pressable>

            <View
              style={
                styles.headerCenter
              }
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                HER CYCLE
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Period Cycle
              </Text>
            </View>

            <View
              style={
                styles.headerButtonPlaceholder
              }
            />
          </View>

          <View
            style={styles.emptyCard}
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Feather
                name="calendar"
                size={25}
                color={
                  COLORS.blue
                }
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Cycle information isn't
              available yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Once her period tracker has
              been set up and shared with you,
              her cycle information will appear
              here.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ==========================================================
  // MAIN SCREEN
  // ==========================================================

  return (
    <View
      style={styles.screen}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.container
        }
      >
        {/* HEADER */}

        <View
          style={styles.header}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.headerButton
            }
          >
            <Feather
              name="chevron-left"
              size={22}
              color={
                COLORS.charcoal
              }
            />
          </Pressable>

          <View
            style={
              styles.headerCenter
            }
          >
            <Text
              style={
                styles.headerEyebrow
              }
            >
              HER CYCLE
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              Period Cycle
            </Text>
          </View>

          <View
            style={
              styles.headerButtonPlaceholder
            }
          />
        </View>

        {/* INTRO */}

        <View
          style={styles.intro}
        >
          <Text
            style={styles.introTitle}
          >
            {girlfriendName}'s cycle
          </Text>

          <Text
            style={
              styles.introSubtitle
            }
          >
            A private, read-only estimate
            based on the cycle information
            she has chosen to share.
          </Text>
        </View>

        {/* CURRENT PHASE */}

        <View
          style={[
            styles.phaseCard,
            {
              backgroundColor:
                phaseBackground(
                  currentPhase
                ),
            },
          ]}
        >
          <View
            style={
              styles.phaseTopRow
            }
          >
            <View
              style={[
                styles.phaseIconCircle,
                {
                  backgroundColor:
                    COLORS.white,
                },
              ]}
            >
              <Feather
                name={
                  phaseIcon(
                    currentPhase
                  ) as any
                }
                size={22}
                color={
                  phaseColor(
                    currentPhase
                  )
                }
              />
            </View>

            <View
              style={
                styles.estimatePill
              }
            >
              <Text
                style={
                  styles.estimateText
                }
              >
                ESTIMATED
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.phaseLabel
            }
          >
            CURRENT PHASE
          </Text>

          <Text
            style={[
              styles.phaseTitle,
              {
                color:
                  phaseColor(
                    currentPhase
                  ),
              },
            ]}
          >
            {currentPhase ||
              'Cycle phase'}
          </Text>

          <Text
            style={
              styles.phaseDescription
            }
          >
            {phaseDescription(
              currentPhase
            )}
          </Text>

          <View
            style={
              styles.phaseStats
            }
          >
            <View
              style={
                styles.phaseStat
              }
            >
              <Text
                style={
                  styles.phaseStatValue
                }
              >
                {cycleDay
                  ? `Day ${cycleDay}`
                  : '—'}
              </Text>

              <Text
                style={
                  styles.phaseStatLabel
                }
              >
                Cycle day
              </Text>
            </View>

            <View
              style={
                styles.statDivider
              }
            />

            <View
              style={
                styles.phaseStat
              }
            >
              <Text
                style={
                  styles.phaseStatValue
                }
              >
                {cycleLength
                  ? `${cycleLength}d`
                  : '—'}
              </Text>

              <Text
                style={
                  styles.phaseStatLabel
                }
              >
                Avg. cycle
              </Text>
            </View>
          </View>
        </View>

        {/* NEXT PERIOD */}

        <View
          style={styles.nextCard}
        >
          <View
            style={
              styles.nextIconCircle
            }
          >
            <Feather
              name="calendar"
              size={20}
              color={
                COLORS.pink
              }
            />
          </View>

          <View
            style={
              styles.nextContent
            }
          >
            <Text
              style={
                styles.cardEyebrow
              }
            >
              ESTIMATED NEXT PERIOD
            </Text>

            <Text
              style={
                styles.nextDate
              }
            >
              {formatDate(
                estimatedNextPeriod
              )}
            </Text>

            {estimatedNextPeriod && (
              <Text
                style={
                  styles.nextHint
                }
              >
                This is an estimate and may
                shift as more cycle history is
                recorded.
              </Text>
            )}
          </View>
        </View>

        {/* CALENDAR */}

        <View
          style={styles.section}
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                CYCLE CALENDAR
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                {monthTitle}
              </Text>
            </View>

            <View
              style={
                styles.monthButtons
              }
            >
              <Pressable
                onPress={
                  previousMonth
                }
                style={
                  styles.monthButton
                }
              >
                <Feather
                  name="chevron-left"
                  size={18}
                  color={
                    COLORS.charcoal
                  }
                />
              </Pressable>

              <Pressable
                onPress={
                  nextMonth
                }
                style={
                  styles.monthButton
                }
              >
                <Feather
                  name="chevron-right"
                  size={18}
                  color={
                    COLORS.charcoal
                  }
                />
              </Pressable>
            </View>
          </View>

          <View
            style={styles.calendarCard}
          >
            <View
              style={
                styles.weekHeader
              }
            >
              {[
                'S',
                'M',
                'T',
                'W',
                'T',
                'F',
                'S',
              ].map(
                (
                  day,
                  index
                ) => (
                  <Text
                    key={`${day}-${index}`}
                    style={
                      styles.weekDay
                    }
                  >
                    {day}
                  </Text>
                )
              )}
            </View>

            <View
              style={
                styles.calendarGrid
              }
            >
              {calendarDays.map(
                (item) => {
                  const period =
                    isPeriodDate(
                      item.date
                    );

                  const ovulation =
                    isOvulationDate(
                      item.date
                    );

                  const fertile =
                    isFertileDate(
                      item.date
                    );

                  const isToday =
                    item.date ===
                    today;

                  return (
                    <View
                      key={
                        item.date
                      }
                      style={
                        styles.dayCell
                      }
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          !item.currentMonth &&
                            styles.dayOutside,
                          period &&
                            styles.dayPeriod,
                          fertile &&
                            !period &&
                            styles.dayFertile,
                          ovulation &&
                            styles.dayOvulation,
                          isToday &&
                            styles.dayToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !item.currentMonth &&
                              styles.dayOutsideText,
                            period &&
                              styles.dayPeriodText,
                            ovulation &&
                              styles.dayOvulationText,
                            isToday &&
                              styles.dayTodayText,
                          ]}
                        >
                          {
                            item.day
                          }
                        </Text>
                      </View>
                    </View>
                  );
                }
              )}
            </View>

            <View
              style={
                styles.legend
              }
            >
              <View
                style={
                  styles.legendItem
                }
              >
                <View
                  style={[
                    styles.legendDot,
                    {
                      backgroundColor:
                        COLORS.pink,
                    },
                  ]}
                />

                <Text
                  style={
                    styles.legendText
                  }
                >
                  Period
                </Text>
              </View>

              <View
                style={
                  styles.legendItem
                }
              >
                <View
                  style={[
                    styles.legendDot,
                    {
                      backgroundColor:
                        COLORS.blue,
                    },
                  ]}
                />

                <Text
                  style={
                    styles.legendText
                  }
                >
                  Fertile
                </Text>
              </View>

              <View
                style={
                  styles.legendItem
                }
              >
                <View
                  style={[
                    styles.legendDot,
                    {
                      backgroundColor:
                        COLORS.lavender,
                    },
                  ]}
                />

                <Text
                  style={
                    styles.legendText
                  }
                >
                  Ovulation
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* CYCLE DETAILS */}

        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionEyebrow
            }
          >
            CYCLE DETAILS
          </Text>

          <Text
            style={
              styles.sectionTitle
            }
          >
            What the estimate is based on
          </Text>

          <View
            style={
              styles.detailsCard
            }
          >
            <View
              style={
                styles.detailRow
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Feather
                  name="repeat"
                  size={17}
                  color={
                    COLORS.blue
                  }
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Average cycle length
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {cycleLength
                    ? `${cycleLength} days`
                    : 'Not available'}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailDivider
              }
            />

            <View
              style={
                styles.detailRow
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Feather
                  name="calendar"
                  size={17}
                  color={
                    COLORS.pink
                  }
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Latest recorded period
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {formatDate(
                    latestPeriod?.start_date
                  )}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailDivider
              }
            />

            <View
              style={
                styles.detailRow
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Feather
                  name="sun"
                  size={17}
                  color={
                    COLORS.orange
                  }
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Estimated ovulation
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {formatDate(
                    estimatedOvulation
                  )}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailDivider
              }
            />

            <View
              style={
                styles.detailRow
              }
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Feather
                  name="activity"
                  size={17}
                  color={
                    COLORS.lavender
                  }
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Period length
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {periodLength} days
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SHARED SYMPTOMS */}

        {visibility ===
          'full' && (
          <View
            style={styles.section}
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  SHARED TODAY
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Symptoms
                </Text>
              </View>

              <View
                style={
                  styles.countPill
                }
              >
                <Text
                  style={
                    styles.countPillText
                  }
                >
                  {
                    todaySymptoms.length
                  }
                </Text>
              </View>
            </View>

            {todaySymptoms.length >
            0 ? (
              <View
                style={
                  styles.symptomsCard
                }
              >
                {todaySymptoms.map(
                  (
                    symptom: any,
                    index: number
                  ) => (
                    <View
                      key={
                        symptom.id ||
                        `${symptom.symptom_type}-${index}`
                      }
                      style={[
                        styles.symptomRow,
                        index <
                          todaySymptoms.length -
                            1 &&
                          styles.symptomRowBorder,
                      ]}
                    >
                      <View
                        style={
                          styles.symptomIcon
                        }
                      >
                        <Feather
                          name="heart"
                          size={16}
                          color={
                            COLORS.pink
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.symptomContent
                        }
                      >
                        <Text
                          style={
                            styles.symptomName
                          }
                        >
                          {
                            symptom.symptom_type
                          }
                        </Text>

                        <Text
                          style={
                            styles.symptomSeverity
                          }
                        >
                          {
                            symptom.severity ||
                            'Logged'
                          }
                        </Text>
                      </View>
                    </View>
                  )
                )}
              </View>
            ) : (
              <View
                style={
                  styles.noSymptomsCard
                }
              >
                <Feather
                  name="check-circle"
                  size={20}
                  color={
                    COLORS.green
                  }
                />

                <Text
                  style={
                    styles.noSymptomsText
                  }
                >
                  No shared symptoms
                  recorded today.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* PRIVACY NOTE */}

        <View
          style={
            styles.estimateNote
          }
        >
          <Feather
            name="info"
            size={17}
            color={
              COLORS.blue
            }
          />

          <Text
            style={
              styles.estimateNoteText
            }
          >
            Cycle phases, fertile windows,
            ovulation and next-period dates
            are estimates. They can change as
            more period history is recorded.
          </Text>
        </View>

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },

  // ==========================================================
  // HEADER
  // ==========================================================

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
  },

  headerButtonPlaceholder: {
    width: 44,
    height: 44,
  },

  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },

  headerEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.pink,
    marginBottom: 4,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.charcoal,
    letterSpacing: -0.3,
  },

  // ==========================================================
  // INTRO
  // ==========================================================

  intro: {
    marginBottom: 20,
  },

  introTitle: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: COLORS.charcoal,
  },

  introSubtitle: {
    marginTop: 8,
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.muted,
  },

  // ==========================================================
  // PHASE
  // ==========================================================

  phaseCard: {
    borderRadius: 25,
    padding: 21,
    marginBottom: 14,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
  },

  phaseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  phaseIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  estimatePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor:
      'rgba(255,255,255,0.75)',
  },

  estimateText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: COLORS.muted,
  },

  phaseLabel: {
    marginTop: 20,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.muted,
  },

  phaseTitle: {
    marginTop: 4,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  phaseDescription: {
    marginTop: 5,
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.muted,
  },

  phaseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor:
      'rgba(0,0,0,0.07)',
  },

  phaseStat: {
    flex: 1,
  },

  phaseStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.charcoal,
  },

  phaseStatLabel: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.muted,
  },

  statDivider: {
    width: 1,
    height: 34,
    backgroundColor:
      'rgba(0,0,0,0.08)',
    marginHorizontal: 16,
  },

  // ==========================================================
  // NEXT PERIOD
  // ==========================================================

  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      COLORS.white,
    borderRadius: 21,
    padding: 17,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    marginBottom: 26,
  },

  nextIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.pinkSoft,
    marginRight: 14,
  },

  nextContent: {
    flex: 1,
  },

  cardEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.muted,
  },

  nextDate: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.charcoal,
  },

  nextHint: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.faint,
  },

  // ==========================================================
  // SECTIONS
  // ==========================================================

  section: {
    marginBottom: 27,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.muted,
  },

  sectionTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: COLORS.charcoal,
  },

  // ==========================================================
  // CALENDAR
  // ==========================================================

  monthButtons: {
    flexDirection: 'row',
    gap: 7,
  },

  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor:
      COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
  },

  calendarCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 23,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    padding: 14,
  },

  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.faint,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
  },

  dayOutside: {
    opacity: 0.32,
  },

  dayOutsideText: {
    color: COLORS.faint,
  },

  dayPeriod: {
    backgroundColor:
      COLORS.pink,
  },

  dayPeriodText: {
    color:
      COLORS.white,
    fontWeight: '800',
  },

  dayFertile: {
    backgroundColor:
      COLORS.blueSoft,
    borderWidth: 1,
    borderColor:
      COLORS.blueBorder,
  },

  dayOvulation: {
    backgroundColor:
      COLORS.lavender,
  },

  dayOvulationText: {
    color:
      COLORS.white,
    fontWeight: '800',
  },

  dayToday: {
    borderWidth: 1.5,
    borderColor:
      COLORS.charcoal,
  },

  dayTodayText: {
    fontWeight: '900',
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.softBorder,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  legendText: {
    fontSize: 10.5,
    color: COLORS.muted,
    fontWeight: '600',
  },

  // ==========================================================
  // DETAILS
  // ==========================================================

  detailsCard: {
    marginTop: 12,
    backgroundColor:
      COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    paddingHorizontal: 16,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor:
      COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 12,
    color: COLORS.muted,
  },

  detailValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.charcoal,
  },

  detailDivider: {
    height: 1,
    backgroundColor:
      COLORS.softBorder,
  },

  // ==========================================================
  // SYMPTOMS
  // ==========================================================

  countPill: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor:
      COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.pink,
  },

  symptomsCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    paddingHorizontal: 16,
  },

  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  symptomRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.softBorder,
  },

  symptomIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor:
      COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  symptomContent: {
    flex: 1,
  },

  symptomName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.charcoal,
  },

  symptomSeverity: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'capitalize',
  },

  noSymptomsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      COLORS.greenSoft,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor:
      '#D7EBDD',
  },

  noSymptomsText: {
    marginLeft: 9,
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.muted,
  },

  // ==========================================================
  // ESTIMATE NOTE
  // ==========================================================

  estimateNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor:
      COLORS.blueSoft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor:
      COLORS.blueBorder,
  },

  estimateNoteText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.muted,
  },

  bottomSpace: {
    height: 20,
  },

  // ==========================================================
  // PRIVATE / EMPTY
  // ==========================================================

  privateCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 26,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    marginTop: 30,
  },

  privateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor:
      COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  privateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.charcoal,
    textAlign: 'center',
  },

  privateText: {
    marginTop: 9,
    fontSize: 13.5,
    lineHeight: 21,
    color: COLORS.muted,
    textAlign: 'center',
  },

  privateDivider: {
    width: '100%',
    height: 1,
    backgroundColor:
      COLORS.softBorder,
    marginVertical: 19,
  },

  privateHint: {
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.faint,
    textAlign: 'center',
  },

  emptyCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 26,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.softBorder,
    marginTop: 30,
  },

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor:
      COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: COLORS.charcoal,
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 9,
    fontSize: 13.5,
    lineHeight: 21,
    color: COLORS.muted,
    textAlign: 'center',
  },

  // ==========================================================
  // ERROR
  // ==========================================================

  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor:
      COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.charcoal,
    textAlign: 'center',
  },

  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    maxWidth: 320,
  },

  primaryButton: {
    marginTop: 18,
    minWidth: 130,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor:
      COLORS.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color:
      COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
});