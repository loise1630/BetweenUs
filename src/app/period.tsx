import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';



import {
    router,

    useFocusEffect,
} from 'expo-router';



import {
    useCallback,

    useMemo,

    useState,
} from 'react';



import {
    ActivityIndicator,

    Alert,

    ScrollView,

    StyleSheet,

    Text,

    View,
} from 'react-native';



import {
    createPeriod,

    deletePeriod,

    getPeriodDashboard,

    getPredictedNextPeriod,

    isDateInPeriod,

    PeriodDashboard,

    PeriodLog,

    savePeriodSettings,
} from '../lib/period';



import {
    getAccountState,
} from '../lib/account';



import {
    colors,

    layout,

    radius,

    shadow,

    spacing,

    type,
} from '../lib/theme';



import {
    Card,

    FadeIn,

    IconButton,

    PressScale,

    Screen,
} from '../lib/ui';





function todayString() {

  const now =

    new Date();



  const year =

    now.getFullYear();



  const month =

    String(

      now.getMonth() + 1

    ).padStart(2, '0');



  const day =

    String(

      now.getDate()

    ).padStart(2, '0');



  return `${year}-${month}-${day}`;

}





function formatReadableDate(

  value: string | null

) {

  if (!value) {

    return 'Not enough data';

  }



  const date =

    new Date(

      `${value}T12:00:00`

    );



  return date.toLocaleDateString(

    undefined,

    {

      month: 'short',

      day: 'numeric',

      year: 'numeric',

    }

  );

}





function getMonthTitle(

  date: Date

) {

  return date.toLocaleDateString(

    undefined,

    {

      month: 'long',

      year: 'numeric',

    }

  );

}





export default function PeriodScreen() {

  const [

    dashboard,

    setDashboard,

  ] =

    useState<PeriodDashboard | null>(

      null

    );



  const [

    loading,

    setLoading,

  ] =

    useState(true);



  const [

    setupReady,

    setSetupReady,

  ] =

    useState(false);



  const [

    saving,

    setSaving,

  ] =

    useState(false);



  const [

    month,

    setMonth,

  ] =

    useState(

      new Date()

    );



  const load = useCallback(

    async () => {

      try {

        const data =

          await getPeriodDashboard();



        setDashboard(data);

      } catch (error: any) {

        console.error(

          'PERIOD LOAD:',

          error

        );



        Alert.alert(

          'Unable to load period data',

          error?.message ||

            'Please try again.'

        );

      } finally {

        setLoading(false);

      }

    },

    []

  );



  useFocusEffect(

    useCallback(() => {

      let active = true;

      async function boot() {

        try {

          const account =

            await getAccountState();



          const key =

            account.user_id

              ? `@betweenus_period_setup_v1_${account.user_id}`

              : '@betweenus_period_setup_v1';



          const completed =

            await AsyncStorage.getItem(key);



          if (!completed) {

            router.replace('/period-setup');

            return;

          }



          if (active) {

            setSetupReady(true);

          }



          await load();

        } catch (error) {

          console.error(

            'PERIOD SETUP CHECK:',

            error

          );



          if (active) {

            setSetupReady(true);

            await load();

          }

        }

      }



      boot();



      return () => {

        active = false;

      };

    }, [load])

  );





  const ownPeriods =

    dashboard?.own.periods ||

    [];



  const settings =

    dashboard?.own.settings;





  const predictedNext =

    settings

      ? getPredictedNextPeriod(

          ownPeriods,

          settings.average_cycle_length

        )

      : null;





  const latestPeriod =

    ownPeriods.length

      ? [...ownPeriods].sort(

          (a, b) =>

            b.start_date.localeCompare(

              a.start_date

            )

        )[0]

      : null;





  const currentPeriod =

    latestPeriod &&

    isDateInPeriod(

      todayString(),

      latestPeriod

    )

      ? latestPeriod

      : null;





  const calendarDays =

    useMemo(

      () =>

        buildCalendarDays(

          month

        ),

      [month]

    );





  async function addTodayPeriod() {

    try {

      setSaving(true);



      await createPeriod(

        todayString(),

        null,

        ''

      );



      await load();



      Alert.alert(

        'Period started',

        'Today has been saved as the start of a new period.'

      );

    } catch (error: any) {

      Alert.alert(

        'Could not save',

        error?.message ||

          'Please try again.'

      );

    } finally {

      setSaving(false);

    }

  }





  async function removePeriod(

    period: PeriodLog

  ) {

    Alert.alert(

      'Delete this period?',

      'This removes the period entry from your private history.',

      [

        {

          text: 'Cancel',

          style: 'cancel',

        },

        {

          text: 'Delete',

          style: 'destructive',

          onPress: async () => {

            try {

              setSaving(true);



              await deletePeriod(

                period.id

              );



              await load();

            } catch (error: any) {

              Alert.alert(

                'Could not delete',

                error?.message ||

                  'Please try again.'

              );

            } finally {

              setSaving(false);

            }

          },

        },

      ]

    );

  }





  async function changeVisibility() {

    if (!settings) {

      return;

    }



    const options = [

      {

        label: 'Private',

        value: 'private' as const,

      },

      {

        label: 'Summary',

        value: 'summary' as const,

      },

      {

        label: 'Full',

        value: 'full' as const,

      },

    ];



    Alert.alert(

      'Partner visibility',

      'Choose how much of your period information your partner can see.',

      [

        ...options.map(

          (option) => ({

            text:

              option.value ===

              settings.partner_visibility

                ? `✓ ${option.label}`

                : option.label,



            onPress: async () => {

              try {

                setSaving(true);



                await savePeriodSettings({

                  ...settings,

                  partner_visibility:

                    option.value,

                });



                await load();

              } catch (error: any) {

                Alert.alert(

                  'Could not update privacy',

                  error?.message ||

                    'Please try again.'

                );

              } finally {

                setSaving(false);

              }

            },

          })

        ),

        {

          text: 'Cancel',

          style: 'cancel',

        },

      ]

    );

  }





  if (!setupReady || loading || !dashboard || !settings) {

    return (

      <Screen>

        <View

          style={styles.loading}

        >

          <ActivityIndicator

            color={colors.primary}

          />

        </View>

      </Screen>

    );

  }





  return (

    <Screen>

      <ScrollView

        contentContainerStyle={

          styles.container

        }

        showsVerticalScrollIndicator={

          false

        }

      >

        {/* HEADER */}



        <FadeIn style={styles.header}>

          <IconButton

            name="arrow-back"

            onPress={() =>

              router.back()

            }

          />



          <View

            style={

              styles.headerCenter

            }

          >

            <Text

              style={

                styles.eyebrow

              }

            >

              PRIVATE TRACKING

            </Text>



            <Text

              style={styles.title}

            >

              Period

            </Text>

          </View>



          <IconButton

            name="settings-outline"

            onPress={

              changeVisibility

            }

          />

        </FadeIn>





        {/* STATUS */}



        <FadeIn

          delay={60}

          style={styles.statusBlock}

        >

          <Text

            style={

              styles.statusTitle

            }

          >

            {currentPeriod

              ? 'Your period is being tracked'

              : 'Your cycle at a glance'}

          </Text>



          <Text

            style={

              styles.statusSubtitle

            }

          >

            {currentPeriod

              ? `Started ${formatReadableDate(

                  currentPeriod.start_date

                )}`

              : predictedNext

              ? `Estimated next period: ${formatReadableDate(

                  predictedNext

                )}`

              : 'Add your first period to begin predictions.'}

          </Text>

        </FadeIn>





        {/* QUICK ACTION */}



        <FadeIn delay={110}>

          <PressScale

            onPress={

              addTodayPeriod

            }

            scaleTo={0.97}

            style={

              styles.startCard

            }

            contentStyle={

              styles.startContent

            }

          >

            <View

              style={

                styles.startIcon

              }

            >

              <Ionicons

                name="calendar-outline"

                size={23}

                color={

                  colors.primary

                }

              />

            </View>



            <View

              style={

                styles.startText

              }

            >

              <Text

                style={

                  styles.startTitle

                }

              >

                {currentPeriod

                  ? 'Period started today'

                  : 'Start period today'}

              </Text>



              <Text

                style={

                  styles.startDescription

                }

              >

                Save today as a new

                period start.

              </Text>

            </View>



            <Ionicons

              name="add"

              size={20}

              color={

                colors.primary

              }

            />

          </PressScale>

        </FadeIn>





        {/* CALENDAR */}



        <FadeIn delay={160}>

          <Card

            style={

              styles.calendarCard

            }

          >

            <View

              style={

                styles.calendarHeader

              }

            >

              <PressScale

                onPress={() =>

                  setMonth(

                    new Date(

                      month.getFullYear(),

                      month.getMonth() - 1,

                      1

                    )

                  )

                }

                scaleTo={0.9}

              >

                <View

                  style={

                    styles.arrowButton

                  }

                >

                  <Ionicons

                    name="chevron-back"

                    size={18}

                    color={

                      colors.text

                    }

                  />

                </View>

              </PressScale>



              <Text

                style={

                  styles.monthTitle

                }

              >

                {getMonthTitle(

                  month

                )}

              </Text>



              <PressScale

                onPress={() =>

                  setMonth(

                    new Date(

                      month.getFullYear(),

                      month.getMonth() + 1,

                      1

                    )

                  )

                }

                scaleTo={0.9}

              >

                <View

                  style={

                    styles.arrowButton

                  }

                >

                  <Ionicons

                    name="chevron-forward"

                    size={18}

                    color={

                      colors.text

                    }

                  />

                </View>

              </PressScale>

            </View>



            <View

              style={

                styles.weekRow

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

                      styles.weekText

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

                (

                  day,

                  index

                ) => {

                  if (

                    !day

                  ) {

                    return (

                      <View

                        key={`empty-${index}`}

                        style={

                          styles.dayCell

                        }

                      />

                    );

                  }



                  const dateString =

                    formatCalendarDate(

                      month,

                      day

                    );



                  const isPeriod =

                    ownPeriods.some(

                      (period) =>

                        isDateInPeriod(

                          dateString,

                          period

                        )

                    );



                  const isToday =

                    dateString ===

                    todayString();



                  return (

                    <View

                      key={dateString}

                      style={

                        styles.dayCell

                      }

                    >

                      <View

                        style={[

                          styles.dayCircle,

                          isPeriod &&

                            styles.periodDay,

                          isToday &&

                            styles.todayDay,

                        ]}

                      >

                        <Text

                          style={[

                            styles.dayText,

                            isPeriod &&

                              styles.periodDayText,

                            isToday &&

                              styles.todayDayText,

                          ]}

                        >

                          {day}

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

                    styles.periodLegend,

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

                    styles.todayLegend,

                  ]}

                />



                <Text

                  style={

                    styles.legendText

                  }

                >

                  Today

                </Text>

              </View>

            </View>

          </Card>

        </FadeIn>





        {/* NEXT PERIOD */}



        <FadeIn delay={210}>

          <View

            style={

              styles.infoRow

            }

          >

            <InfoCard

              icon="calendar-outline"

              label="Next expected"

              value={

                formatReadableDate(

                  predictedNext

                )

              }

            />



            <InfoCard

              icon="repeat-outline"

              label="Cycle length"

              value={`${settings.average_cycle_length} days`}

            />

          </View>

        </FadeIn>





        {/* HISTORY */}



        <FadeIn delay={260}>

          <Text

            style={

              styles.sectionLabel

            }

          >

            History

          </Text>



          {ownPeriods.length ===

          0 ? (

            <Card

              style={

                styles.emptyCard

              }

            >

              <Ionicons

                name="calendar-clear-outline"

                size={25}

                color={

                  colors.textFaint

                }

              />



              <Text

                style={

                  styles.emptyTitle

                }

              >

                No periods logged yet

              </Text>



              <Text

                style={

                  styles.emptyText

                }

              >

                Your period history

                will appear here once

                you start tracking.

              </Text>

            </Card>

          ) : (

            ownPeriods

              .slice(0, 8)

              .map(

                (period) => (

                  <Card

                    key={period.id}

                    style={

                      styles.historyCard

                    }

                  >

                    <View

                      style={

                        styles.historyIcon

                      }

                    >

                      <Ionicons

                        name="heart-outline"

                        size={19}

                        color={

                          colors.primary

                        }

                      />

                    </View>



                    <View

                      style={

                        styles.historyText

                      }

                    >

                      <Text

                        style={

                          styles.historyTitle

                        }

                      >

                        {formatReadableDate(

                          period.start_date

                        )}

                      </Text>



                      <Text

                        style={

                          styles.historySubtitle

                        }

                      >

                        {period.end_date

                          ? `Ended ${formatReadableDate(

                              period.end_date

                            )}`

                          : 'Currently open'}

                      </Text>

                    </View>



                    <PressScale

                      onPress={() =>

                        removePeriod(

                          period

                        )

                      }

                      scaleTo={0.9}

                    >

                      <Ionicons

                        name="trash-outline"

                        size={17}

                        color={

                          colors.textFaint

                        }

                      />

                    </PressScale>

                  </Card>

                )

              )

          )}

        </FadeIn>





        {/* PRIVACY */}



        <FadeIn delay={310}>

          <Text

            style={

              styles.sectionLabel

            }

          >

            Privacy

          </Text>



          <PressScale

            onPress={

              changeVisibility

            }

            scaleTo={0.98}

            style={

              styles.privacyCard

            }

            contentStyle={

              styles.privacyContent

            }

          >

            <View

              style={

                styles.privacyIcon

              }

            >

              <Ionicons

                name="lock-closed-outline"

                size={20}

                color={

                  colors.textMuted

                }

              />

            </View>



            <View

              style={

                styles.privacyText

              }

            >

              <Text

                style={

                  styles.privacyTitle

                }

              >

                Partner visibility

              </Text>



              <Text

                style={

                  styles.privacyDescription

                }

              >

                {settings.partner_visibility ===

                'private'

                  ? 'Only you can see your period data.'

                  : settings.partner_visibility ===

                    'summary'

                  ? 'Your partner can see cycle summaries, but not your private notes or history.'

                  : 'Your partner can see your shared period history.'}

              </Text>

            </View>



            <Text

              style={

                styles.visibilityValue

              }

            >

              {(settings?.partner_visibility ?? 'private')
                .replace(/^./, (char) => char.toUpperCase())}

            </Text>

          </PressScale>

        </FadeIn>





        {saving && (

          <View

            style={

              styles.saving

            }

          >

            <ActivityIndicator

              size="small"

              color={

                colors.primary

              }

            />



            <Text

              style={

                styles.savingText

              }

            >

              Saving…

            </Text>

          </View>

        )}

      </ScrollView>

    </Screen>

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

    <Card

      style={

        styles.infoCard

      }

    >

      <Ionicons

        name={icon}

        size={19}

        color={colors.primary}

      />



      <Text

        style={

          styles.infoLabel

        }

      >

        {label}

      </Text>



      <Text

        style={

          styles.infoValue

        }

        numberOfLines={2}

      >

        {value}

      </Text>

    </Card>

  );

}





function buildCalendarDays(

  month: Date

) {

  const year =

    month.getFullYear();



  const monthIndex =

    month.getMonth();



  const firstDay =

    new Date(

      year,

      monthIndex,

      1

    ).getDay();



  const totalDays =

    new Date(

      year,

      monthIndex + 1,

      0

    ).getDate();



  const result: (

    | number

    | null

  )[] = [];



  for (

    let i = 0;

    i < firstDay;

    i++

  ) {

    result.push(null);

  }



  for (

    let day = 1;

    day <= totalDays;

    day++

  ) {

    result.push(day);

  }



  while (

    result.length % 7 !==

    0

  ) {

    result.push(null);

  }



  return result;

}





function formatCalendarDate(

  month: Date,

  day: number

) {

  const year =

    month.getFullYear();



  const monthNumber =

    String(

      month.getMonth() + 1

    ).padStart(2, '0');



  const dayNumber =

    String(day).padStart(

      2,

      '0'

    );



  return `${year}-${monthNumber}-${dayNumber}`;

}





const styles = StyleSheet.create({

  container: {

    paddingHorizontal:

      layout.screenPadding,

    paddingTop: spacing.md,

    paddingBottom: 70,

  },



  loading: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },



  header: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:

      'space-between',

  },



  headerCenter: {

    alignItems: 'center',

  },



  eyebrow: {

    fontSize: 9,

    letterSpacing: 1.4,

    fontWeight: '700',

    color: colors.textFaint,

  },



  title: {

    marginTop: 3,

    ...type.title,

    fontSize: 18,

    color: colors.text,

  },



  statusBlock: {

    marginTop: spacing.xxl,

  },



  statusTitle: {

    ...type.display,

    fontSize: 26,

    color: colors.text,

  },



  statusSubtitle: {

    marginTop: spacing.sm,

    fontSize: 13,

    lineHeight: 20,

    color: colors.textMuted,

  },



  startCard: {

    marginTop: spacing.xl,

    borderRadius: radius.xl,

    backgroundColor:

      colors.surface,

    ...shadow.soft,

  },



  startContent: {

    flexDirection: 'row',

    alignItems: 'center',

    padding: spacing.lg,

  },



  startIcon: {

    width: 46,

    height: 46,

    borderRadius: radius.lg,

    backgroundColor:

      colors.surfaceAlt,

    alignItems: 'center',

    justifyContent: 'center',

  },



  startText: {

    flex: 1,

    marginLeft: spacing.md,

    marginRight: spacing.sm,

  },



  startTitle: {

    fontSize: 14,

    fontWeight: '600',

    color: colors.text,

  },



  startDescription: {

    marginTop: 4,

    fontSize: 11,

    color: colors.textMuted,

  },



  calendarCard: {

    marginTop: spacing.xl,

    padding: spacing.lg,

  },



  calendarHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:

      'space-between',

  },



  arrowButton: {

    width: 36,

    height: 36,

    borderRadius:

      radius.pill,

    backgroundColor:

      colors.surfaceAlt,

    alignItems: 'center',

    justifyContent: 'center',

  },



  monthTitle: {

    fontSize: 15,

    fontWeight: '600',

    color: colors.text,

  },



  weekRow: {

    flexDirection: 'row',

    marginTop: spacing.lg,

  },



  weekText: {

    width: '14.285%',

    textAlign: 'center',

    fontSize: 11,

    fontWeight: '600',

    color: colors.textFaint,

  },



  calendarGrid: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    marginTop: spacing.sm,

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

    color: colors.text,

  },



  periodDay: {

    backgroundColor:

      colors.primary,

  },



  periodDayText: {

    color: colors.white,

    fontWeight: '600',

  },



  todayDay: {

    borderWidth: 1.5,

    borderColor:

      colors.blue,

  },



  todayDayText: {

    fontWeight: '700',

  },



  legend: {

    flexDirection: 'row',

    gap: spacing.lg,

    marginTop: spacing.md,

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

    backgroundColor:

      colors.primary,

  },



  todayLegend: {

    borderWidth: 1.5,

    borderColor:

      colors.blue,

  },



  legendText: {

    fontSize: 10,

    color: colors.textMuted,

  },



  infoRow: {

    flexDirection: 'row',

    gap: spacing.md,

    marginTop: spacing.md,

  },



  infoCard: {

    flex: 1,

    padding: spacing.lg,

  },



  infoLabel: {

    marginTop: spacing.md,

    fontSize: 10,

    color: colors.textFaint,

  },



  infoValue: {

    marginTop: 4,

    fontSize: 13,

    fontWeight: '600',

    color: colors.text,

  },



  sectionLabel: {

    marginTop: spacing.xxxl,

    marginBottom: spacing.md,

    ...type.title,

    fontSize: 17,

    color: colors.text,

  },



  emptyCard: {

    alignItems: 'center',

    padding: spacing.xxl,

  },



  emptyTitle: {

    marginTop: spacing.md,

    fontSize: 14,

    fontWeight: '600',

    color: colors.text,

  },



  emptyText: {

    marginTop: 5,

    fontSize: 11,

    lineHeight: 17,

    color: colors.textMuted,

    textAlign: 'center',

  },



  historyCard: {

    marginBottom: spacing.sm,

    padding: spacing.md,

    flexDirection: 'row',

    alignItems: 'center',

  },



  historyIcon: {

    width: 40,

    height: 40,

    borderRadius: radius.lg,

    backgroundColor:

      colors.surfaceAlt,

    alignItems: 'center',

    justifyContent: 'center',

  },



  historyText: {

    flex: 1,

    marginLeft: spacing.md,

  },



  historyTitle: {

    fontSize: 13,

    fontWeight: '600',

    color: colors.text,

  },



  historySubtitle: {

    marginTop: 3,

    fontSize: 11,

    color: colors.textMuted,

  },



  privacyCard: {

    borderRadius: radius.xl,

    backgroundColor:

      colors.surface,

    ...shadow.soft,

  },



  privacyContent: {

    flexDirection: 'row',

    alignItems: 'center',

    padding: spacing.lg,

  },



  privacyIcon: {

    width: 44,

    height: 44,

    borderRadius: radius.lg,

    backgroundColor:

      colors.surfaceAlt,

    alignItems: 'center',

    justifyContent: 'center',

  },



  privacyText: {

    flex: 1,

    marginLeft: spacing.md,

    marginRight: spacing.sm,

  },



  privacyTitle: {

    fontSize: 13,

    fontWeight: '600',

    color: colors.text,

  },



  privacyDescription: {

    marginTop: 4,

    fontSize: 10,

    lineHeight: 16,

    color: colors.textMuted,

  },



  visibilityValue: {

    fontSize: 11,

    fontWeight: '600',

    color: colors.primary,

  },



  saving: {

    marginTop: spacing.lg,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

  },



  savingText: {

    fontSize: 11,

    color: colors.textMuted,

  },

});