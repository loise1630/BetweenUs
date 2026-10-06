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
    AccountState,
    getAccountState,
} from '../lib/account';

import {
    CyclePhase,
    getCurrentCycleInfo,
    getPeriodDashboard,
    PeriodDashboard,
} from '../lib/period';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

// ============================================================
// COLORS
// Based directly on the Between Us landing page
// ============================================================

const COLORS = {
  background: '#FDFDFB',
  charcoal: '#17181C',
  pink: '#E5609F',
  pinkSoft: '#FCE8F1',
  blue: '#7FA2F2',
  blueSoft: '#EEF3FD',
  lavender: '#9690E1',
  text: '#17181C',
  muted: '#6B7280',
  faint: '#9AA1AC',
  border: '#C9D2E0',
  white: '#FFFFFF',
  card: '#FFFFFF',
};

// ============================================================
// TYPES
// ============================================================

type CycleInfoLike = {
  cycleDay?: number | null;
  phase?: CyclePhase | string | null;
  nextPeriod?: string | null;
  latestPeriod?: {
    start_date?: string | null;
    end_date?: string | null;
  } | null;
};

// ============================================================
// HELPERS
// ============================================================

function getPhaseDescription(
  phase: CyclePhase | string | null | undefined
): string {
  switch (phase) {
    case 'Period':
      return 'Your period phase. Take it easy and listen to your body.';

    case 'Follicular':
      return 'Your body is moving toward ovulation as the cycle progresses.';

    case 'Ovulation':
      return 'This is the estimated ovulation phase of your cycle.';

    case 'Luteal':
      return 'This is the phase after estimated ovulation.';

    default:
      return 'Your current cycle phase is estimated from your logged periods.';
  }
}

function getTodayString(): string {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatShortDate(
  dateString: string | null | undefined
): string {
  if (!dateString) {
    return '—';
  }

  const date = new Date(
    `${dateString}T12:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

function formatCyclePhase(
  phase: CyclePhase | string | null | undefined
): string {
  if (!phase) {
    return 'Not available';
  }

  return phase
    .charAt(0)
    .toUpperCase() +
    phase.slice(1);
}

// ============================================================
// SCREEN
// ============================================================

export default function GirlfriendScreen() {
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

  const loadData =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const accountState =
            await getAccountState();

          setAccount(
            accountState
          );

          try {
            const periodDashboard =
              await getPeriodDashboard();

            setDashboard(
              periodDashboard
            );
          } catch (periodError) {
            console.log(
              'PERIOD DASHBOARD ERROR:',
              periodError
            );

            /*
             * The girlfriend screen should
             * still work even if the period
             * tables/RPC are not ready yet.
             */
            setDashboard(null);
          }
        } catch (error) {
          console.error(
            'GIRLFRIEND ACCOUNT ERROR:',
            error
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="small"
            color={
              COLORS.pink
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // INVALID ACCOUNT
  // ==========================================================

  if (
    !account ||
    account.status === 'new'
  ) {
    router.replace('/');
    return null;
  }

  // ==========================================================
  // PARTNER
  // ==========================================================

  const members =
    account.members || [];

  const boyfriend =
    members.find(
      (member) =>
        member.role ===
        'boyfriend'
    );

  // ==========================================================
  // PERIOD DATA
  // ==========================================================

  const settings =
    dashboard?.own?.settings;

  const periods =
    dashboard?.own?.periods || [];

  const symptoms =
    dashboard?.own?.symptoms || [];

  let cycleInfo:
    CycleInfoLike | null =
    null;

  if (
    settings &&
    periods.length > 0
  ) {
    try {
      cycleInfo =
        getCurrentCycleInfo(
          periods,
          settings
        ) as CycleInfoLike;
    } catch (error) {
      console.log(
        'CYCLE INFO ERROR:',
        error
      );
    }
  }

  const hasPeriod =
    periods.length > 0;

  const cycleDay =
    cycleInfo?.cycleDay ??
    null;

  const phase =
    cycleInfo?.phase ??
    null;

  const nextPeriod =
    cycleInfo?.nextPeriod ??
    null;

  const today =
    getTodayString();

  const todaySymptoms =
    symptoms.filter(
      (symptom) =>
        symptom.symptom_date ===
        today
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ====================================================
            HEADER
        ===================================================== */}

        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Feather
              name="arrow-left"
              size={21}
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
              YOUR SPACE
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              Girlfriend
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/settings'
              )
            }
            style={({ pressed }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Feather
              name="settings"
              size={20}
              color={
                COLORS.charcoal
              }
            />
          </Pressable>
        </View>

        {/* ====================================================
            GREETING
        ===================================================== */}

        <View
          style={
            styles.greeting
          }
        >
          <Text
            style={
              styles.greetingTitle
            }
          >
            {boyfriend?.name
              ? `For ${boyfriend.name}`
              : 'Your relationship space'}
          </Text>

          <Text
            style={
              styles.greetingSubtitle
            }
          >
            A private place for
            the things that matter
            between you two.
          </Text>
        </View>

        {/* ====================================================
            CYCLE SECTION
        ===================================================== */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Your cycle
          </Text>

          <Pressable
            onPress={() =>
              router.push(
                '/period'
              )
            }
            hitSlop={10}
            style={({ pressed }) => [
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.viewTracker
              }
            >
              View tracker
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() =>
            router.push(
              '/period'
            )
          }
          style={({ pressed }) => [
            styles.cycleCard,
            pressed &&
              styles.cardPressed,
          ]}
        >
          {hasPeriod &&
          cycleInfo ? (
            <>
              {/* ==========================================
                  ACTIVE CYCLE
              =========================================== */}

              <View
                style={
                  styles.cycleHeader
                }
              >
                <View
                  style={
                    styles.cycleIcon
                  }
                >
                  <Feather
                    name="heart"
                    size={21}
                    color={
                      COLORS.pink
                    }
                  />
                </View>

                <View
                  style={
                    styles.cycleHeaderText
                  }
                >
                  <Text
                    style={
                      styles.smallLabel
                    }
                  >
                    CURRENT PHASE
                  </Text>

                  <Text
                    style={
                      styles.cyclePhase
                    }
                  >
                    {formatCyclePhase(
                      phase
                    )}
                  </Text>

                  <Text
                    style={
                      styles.cycleDescription
                    }
                    numberOfLines={2}
                  >
                    {getPhaseDescription(
                      phase
                    )}
                  </Text>
                </View>

                <Feather
                  name="chevron-right"
                  size={19}
                  color={
                    COLORS.faint
                  }
                />
              </View>

              {/* ==========================================
                  STATS
              =========================================== */}

              <View
                style={
                  styles.divider
                }
              />

              <View
                style={
                  styles.statsRow
                }
              >
                <CycleStat
                  label="Cycle day"
                  value={
                    cycleDay
                      ? `Day ${cycleDay}`
                      : '—'
                  }
                />

                <View
                  style={
                    styles.statDivider
                  }
                />

                <CycleStat
                  label="Cycle length"
                  value={`${settings?.average_cycle_length || 28} days`}
                />

                <View
                  style={
                    styles.statDivider
                  }
                />

                <CycleStat
                  label="Next period"
                  value={
                    nextPeriod
                      ? formatShortDate(
                          nextPeriod
                        )
                      : '—'
                  }
                />
              </View>

              {/* ==========================================
                  TODAY'S SYMPTOMS
              =========================================== */}

              {todaySymptoms.length >
                0 && (
                <View
                  style={
                    styles.symptomRow
                  }
                >
                  <View
                    style={
                      styles.symptomIcon
                    }
                  >
                    <Feather
                      name="activity"
                      size={14}
                      color={
                        COLORS.pink
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.symptomText
                    }
                  >
                    {todaySymptoms.length}{' '}
                    {todaySymptoms.length ===
                    1
                      ? 'symptom'
                      : 'symptoms'}{' '}
                    logged today
                  </Text>

                  <Feather
                    name="chevron-right"
                    size={15}
                    color={
                      COLORS.faint
                    }
                  />
                </View>
              )}
            </>
          ) : (
            <>
              {/* ==========================================
                  EMPTY STATE
              =========================================== */}

              <View
                style={
                  styles.cycleHeader
                }
              >
                <View
                  style={
                    styles.cycleIcon
                  }
                >
                  <Feather
                    name="calendar"
                    size={21}
                    color={
                      COLORS.pink
                    }
                  />
                </View>

                <View
                  style={
                    styles.cycleHeaderText
                  }
                >
                  <Text
                    style={
                      styles.smallLabel
                    }
                  >
                    PERIOD TRACKER
                  </Text>

                  <Text
                    style={
                      styles.cyclePhase
                    }
                  >
                    Start tracking
                  </Text>

                  <Text
                    style={
                      styles.cycleDescription
                    }
                  >
                    Log your period to
                    start estimating
                    your cycle.
                  </Text>
                </View>

                <Feather
                  name="chevron-right"
                  size={19}
                  color={
                    COLORS.faint
                  }
                />
              </View>

              <View
                style={
                  styles.emptyAction
                }
              >
                <Feather
                  name="plus-circle"
                  size={17}
                  color={
                    COLORS.pink
                  }
                />

                <Text
                  style={
                    styles.emptyActionText
                  }
                >
                  Open Period Tracker
                </Text>
              </View>
            </>
          )}
        </Pressable>

        {/* ====================================================
            YOUR SPACE
        ===================================================== */}

        <Text
          style={
            styles.sectionTitleSpaced
          }
        >
          Your space
        </Text>

        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [
            styles.primaryCard,
            pressed &&
              styles.cardPressed,
          ]}
        >
          <View
            style={
              styles.primaryIcon
            }
          >
            <Feather
              name="heart"
              size={21}
              color={
                COLORS.pink
              }
            />
          </View>

          <View
            style={
              styles.primaryText
            }
          >
            <Text
              style={
                styles.primaryTitle
              }
            >
              How are you two?
            </Text>

            <Text
              style={
                styles.primaryDescription
              }
            >
              Check in, share how
              you're feeling, and
              stay connected.
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={19}
            color={
              COLORS.faint
            }
          />
        </Pressable>

        {/* ====================================================
            MORE FOR YOU TWO
        ===================================================== */}

        <Text
          style={
            styles.sectionTitleSpaced
          }
        >
          More for you two
        </Text>

        <View
          style={
            styles.featureGrid
          }
        >
          <FeatureCard
            icon="message-circle"
            title="Unsaid"
            description="Say what feels hard to say."
            iconColor={
              COLORS.pink
            }
          />

          <FeatureCard
            icon="book-open"
            title="Our Journal"
            description="Keep your moments together."
            iconColor={
              COLORS.blue
            }
          />

          <FeatureCard
            icon="star"
            title="Little Things"
            description="Save the small things you love."
            iconColor={
              COLORS.pink
            }
          />

          <FeatureCard
            icon="mail"
            title="Open When"
            description="Messages for the right moment."
            iconColor={
              COLORS.blue
            }
          />
        </View>

        {/* ====================================================
            AI CARD
        ===================================================== */}

        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [
            styles.aiCard,
            pressed &&
              styles.cardPressed,
          ]}
        >
          <View
            style={
              styles.aiIcon
            }
          >
            <Feather
              name="zap"
              size={19}
              color={
                COLORS.pink
              }
            />
          </View>

          <View
            style={
              styles.aiText
            }
          >
            <Text
              style={
                styles.aiTitle
              }
            >
              Need help saying it?
            </Text>

            <Text
              style={
                styles.aiDescription
              }
            >
              Let the communication
              helper help you put
              your thoughts into
              words.
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={18}
            color={
              COLORS.faint
            }
          />
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// CYCLE STAT
// ============================================================

function CycleStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.cycleStat
      }
    >
      <Text
        style={
          styles.statLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.statValue
        }
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

// ============================================================
// FEATURE CARD
// ============================================================

function FeatureCard({
  icon,
  title,
  description,
  iconColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={() => {}}
      style={({ pressed }) => [
        styles.featureCard,
        pressed &&
          styles.cardPressed,
      ]}
    >
      <View
        style={[
          styles.featureIcon,
          {
            backgroundColor:
              iconColor ===
              COLORS.pink
                ? COLORS.pinkSoft
                : COLORS.blueSoft,
          },
        ]}
      >
        <Feather
          name={icon}
          size={19}
          color={iconColor}
        />
      </View>

      <Text
        style={
          styles.featureTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.featureDescription
        }
        numberOfLines={2}
      >
        {description}
      </Text>

      <Feather
        name="arrow-up-right"
        size={15}
        color={
          COLORS.faint
        }
        style={
          styles.featureArrow
        }
      />
    </Pressable>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    container: {
      paddingHorizontal: 24,
      paddingBottom: 44,
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.background,
    },

    // ========================================================
    // HEADER
    // ========================================================

    header: {
      marginTop: 12,
      height: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerCenter: {
      alignItems:
        'center',
    },

    headerEyebrow: {
      fontSize: 9,
      letterSpacing: 1.6,
      fontWeight: '700',
      color:
        COLORS.faint,
    },

    headerTitle: {
      marginTop: 3,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.3,
      color:
        COLORS.charcoal,
    },

    // ========================================================
    // GREETING
    // ========================================================

    greeting: {
      marginTop: 44,
    },

    greetingTitle: {
      fontSize: 31,
      lineHeight: 38,
      fontWeight: '500',
      letterSpacing: -1.1,
      color:
        COLORS.charcoal,
    },

    greetingSubtitle: {
      marginTop: 14,
      maxWidth: 320,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '300',
      color:
        COLORS.muted,
    },

    // ========================================================
    // SECTION
    // ========================================================

    sectionHeader: {
      marginTop: 40,
      marginBottom: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '500',
      letterSpacing: -0.35,
      color:
        COLORS.charcoal,
    },

    sectionTitleSpaced: {
      marginTop: 38,
      marginBottom: 14,
      fontSize: 18,
      fontWeight: '500',
      letterSpacing: -0.35,
      color:
        COLORS.charcoal,
    },

    viewTracker: {
      fontSize: 14,
      fontWeight: '400',
      color:
        COLORS.pink,
    },

    // ========================================================
    // CYCLE CARD
    // ========================================================

    cycleCard: {
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 24,
      backgroundColor:
        COLORS.white,
      padding: 20,
    },

    cycleHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    cycleIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        COLORS.pinkSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    cycleHeaderText: {
      flex: 1,
      marginLeft: 14,
      marginRight: 8,
    },

    smallLabel: {
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: '700',
      color:
        COLORS.faint,
    },

    cyclePhase: {
      marginTop: 3,
      fontSize: 18,
      fontWeight: '500',
      letterSpacing: -0.35,
      color:
        COLORS.charcoal,
    },

    cycleDescription: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '300',
      color:
        COLORS.muted,
    },

    divider: {
      height: 1,
      backgroundColor:
        '#E8ECF1',
      marginVertical: 20,
    },

    statsRow: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
    },

    cycleStat: {
      flex: 1,
      minWidth: 0,
    },

    statDivider: {
      width: 1,
      backgroundColor:
        '#E8ECF1',
      marginHorizontal: 12,
    },

    statLabel: {
      fontSize: 10,
      lineHeight: 14,
      color:
        COLORS.faint,
    },

    statValue: {
      marginTop: 5,
      fontSize: 14,
      fontWeight: '500',
      color:
        COLORS.charcoal,
    },

    symptomRow: {
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#E8ECF1',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    symptomIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor:
        COLORS.pinkSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    symptomText: {
      flex: 1,
      marginLeft: 10,
      fontSize: 12,
      fontWeight: '400',
      color:
        COLORS.muted,
    },

    emptyAction: {
      marginTop: 18,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor:
        '#E8ECF1',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    emptyActionText: {
      marginLeft: 9,
      fontSize: 13,
      fontWeight: '500',
      color:
        COLORS.pink,
    },

    // ========================================================
    // PRIMARY CARD
    // ========================================================

    primaryCard: {
      minHeight: 96,
      padding: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 24,
      backgroundColor:
        COLORS.white,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    primaryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        COLORS.pinkSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    primaryText: {
      flex: 1,
      marginLeft: 14,
      marginRight: 8,
    },

    primaryTitle: {
      fontSize: 15,
      fontWeight: '500',
      color:
        COLORS.charcoal,
    },

    primaryDescription: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '300',
      color:
        COLORS.muted,
    },

    // ========================================================
    // FEATURE GRID
    // ========================================================

    featureGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'space-between',
      rowGap: 12,
    },

    featureCard: {
      width: '48.2%',
      minHeight: 158,
      padding: 17,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 22,
      backgroundColor:
        COLORS.white,
    },

    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    featureTitle: {
      marginTop: 17,
      fontSize: 14,
      fontWeight: '500',
      color:
        COLORS.charcoal,
    },

    featureDescription: {
      marginTop: 5,
      paddingRight: 5,
      fontSize: 11,
      lineHeight: 17,
      fontWeight: '300',
      color:
        COLORS.muted,
    },

    featureArrow: {
      position: 'absolute',
      right: 17,
      bottom: 17,
    },

    // ========================================================
    // AI
    // ========================================================

    aiCard: {
      marginTop: 16,
      minHeight: 92,
      padding: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 24,
      backgroundColor:
        COLORS.white,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    aiIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        COLORS.pinkSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    aiText: {
      flex: 1,
      marginLeft: 13,
      marginRight: 8,
    },

    aiTitle: {
      fontSize: 14,
      fontWeight: '500',
      color:
        COLORS.charcoal,
    },

    aiDescription: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 17,
      fontWeight: '300',
      color:
        COLORS.muted,
    },

    // ========================================================
    // PRESS STATES
    // ========================================================

    pressed: {
      opacity: 0.65,
    },

    cardPressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },
  });