import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import CycleTabBar from '../components/CycleTabBar';
import { useCycleDashboard } from '../hooks/use-cycle-dashboard';
import { getCycleInfoForDate, getSymptomsForDate, isDateInPeriod, parseDate } from '../lib/period';
import { Screen } from '../lib/ui';

const PINK = '#F4768F';
const PURPLE = '#A58BE0';
const TEXT = '#282638';
const MUTED = '#84808D';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const keyFor = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftMonth = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);

export default function PeriodCalendarScreen() {
  const { loading, error, viewerMode, periods, symptoms, settings, reload } = useCycleDashboard();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [selectedDate, setSelectedDate] = useState(today());
  const cycleLength = settings.average_cycle_length || 28;
  const periodLength = settings.average_period_length || 5;
  const latest = useMemo(() => [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null, [periods]);
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const offset = first.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
      const dayNumber = index - offset + 1;
      if (dayNumber < 1 || dayNumber > count) return null;
      const date = new Date(month.getFullYear(), month.getMonth(), dayNumber, 12);
      return keyFor(date);
    });
  }, [month]);
  const selectedSymptoms = getSymptomsForDate(symptoms, selectedDate);
  const selectedInfo = getCycleInfoForDate(periods, settings, selectedDate);
  const selectedPeriod = periods.some((period) => isDateInPeriod(selectedDate, period, periodLength));
  const isTodaySelected = selectedDate === today();
  const selectedLabel = parseDate(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const moveMonth = (amount: number) => {
    const nextMonth = shiftMonth(month, amount);
    setMonth(nextMonth);
    setSelectedDate(keyFor(nextMonth));
  };

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to period tracker" onPress={() => router.replace('/period' as any)} style={styles.back}>
            <Ionicons name="arrow-back" size={21} color={TEXT} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.subtitle}>{viewerMode ? "Her cycle at a glance" : 'Your cycle at a glance'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh calendar" onPress={reload} style={styles.back}>
            <Ionicons name="refresh-outline" size={20} color={TEXT} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={PINK} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Could not load the calendar</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={reload} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.calendarCard}>
              <View style={styles.monthRow}>
                <Pressable accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={styles.monthButton}>
                  <Ionicons name="chevron-back" size={20} color={TEXT} />
                </Pressable>
                <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                <Pressable accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={styles.monthButton}>
                  <Ionicons name="chevron-forward" size={20} color={TEXT} />
                </Pressable>
              </View>

              <View style={styles.grid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
                {days.map((date, index) => {
                  if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
                  const dayInfo = periods.length ? getCycleInfoForDate(periods, settings, date) : null;
                  const actualPeriodDay = periods.some((period) => isDateInPeriod(date, period, periodLength));
                  const periodDay = actualPeriodDay || (!!latest && date >= latest.start_date && !!dayInfo?.cycleDay && dayInfo.cycleDay <= periodLength);
                  const ovulationCycleDay = Math.max(1, cycleLength - 14);
                  const fertileDay = !!latest && date >= latest.start_date && !!dayInfo?.cycleDay && dayInfo.cycleDay >= ovulationCycleDay - 5 && dayInfo.cycleDay <= ovulationCycleDay + 1;
                  const ovulationDay = !!latest && date >= latest.start_date && dayInfo?.cycleDay === ovulationCycleDay;
                  const selected = selectedDate === date;
                  const isToday = date === today();
                  const hasSymptom = symptoms.some((item) => item.symptom_date === date);
                  return (
                    <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${parseDate(date).toDateString()}${periodDay ? ', period day' : ''}`} onPress={() => setSelectedDate(date)} style={styles.dayCell}>
                      <View style={[styles.dayCircle, periodDay && styles.periodDay, fertileDay && !periodDay && styles.fertileDay, selected && styles.selectedDay, isToday && !selected && styles.todayDay]}>
                        <Text style={[styles.dayText, periodDay && !selected && styles.periodText, selected && styles.selectedText]}>{parseDate(date).getDate()}</Text>
                      </View>
                      <View style={styles.dots}>
                        {ovulationDay ? <View style={[styles.dot, { backgroundColor: PURPLE }]} /> : null}
                        {hasSymptom ? <View style={[styles.dot, { backgroundColor: '#E9B34F' }]} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.legend}>
                <Legend color={PINK} label="Period" />
                <Legend color="#F7E9B7" label="Fertile window" />
                <Legend color={PURPLE} label="Ovulation" />
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailEyebrow}>{isTodaySelected ? 'TODAY' : 'SELECTED DAY'}</Text>
              <Text style={styles.detailTitle}>{selectedLabel}</Text>
              <Text style={styles.detailPhase}>
                {periods.length === 0 ? 'No cycle data yet' : selectedPeriod ? 'Period' : `${selectedInfo.phase} phase`}
                {periods.length > 0 && selectedInfo.cycleDay ? ` · Day ${selectedInfo.cycleDay}` : ''}
              </Text>
              {selectedSymptoms.length ? (
                <View style={styles.symptomWrap}>
                  {selectedSymptoms.map((symptom) => <View key={symptom.id} style={styles.symptomPill}><Text style={styles.symptomText}>{symptom.symptom_type}</Text></View>)}
                </View>
              ) : (
                <Text style={styles.muted}>{viewerMode ? 'No symptoms were shared for this day.' : 'No symptoms logged for this day.'}</Text>
              )}
            </View>

            <Text style={styles.footnote}>Cycle and fertile-window dates are estimates based on logged history.</Text>
          </ScrollView>
        )}

        <CycleTabBar active="calendar" />
      </View>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFDFD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2E8EB' },
  headerText: { flex: 1 },
  title: { fontSize: 21, fontWeight: '700', color: TEXT },
  subtitle: { marginTop: 2, fontSize: 12, color: MUTED },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18, gap: 14 },
  calendarCard: { padding: 15, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2E8EB' },
  monthRow: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFF5F7' },
  monthTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: MUTED, fontSize: 11, fontWeight: '600', paddingVertical: 7 },
  dayCell: { width: '14.2857%', height: 47, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  dayText: { color: TEXT, fontSize: 13 },
  periodDay: { backgroundColor: '#FDE7EC' },
  periodText: { color: '#CA526C', fontWeight: '700' },
  fertileDay: { backgroundColor: '#FCF5DE' },
  selectedDay: { backgroundColor: PINK },
  selectedText: { color: '#FFFFFF', fontWeight: '700' },
  todayDay: { borderWidth: 1.5, borderColor: PINK },
  dots: { position: 'absolute', bottom: 1, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, borderTopWidth: 1, borderTopColor: '#F6EEF0', paddingTop: 13, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: MUTED, fontSize: 10 },
  detailCard: { padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2E8EB' },
  detailEyebrow: { color: PINK, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  detailTitle: { color: TEXT, fontSize: 19, fontWeight: '700', marginTop: 6 },
  detailPhase: { color: PURPLE, fontSize: 13, fontWeight: '600', marginTop: 5, marginBottom: 9 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
  symptomWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 5 },
  symptomPill: { backgroundColor: '#F6F1FC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  symptomText: { color: '#6A5597', fontSize: 11, fontWeight: '600' },
  footnote: { color: MUTED, fontSize: 10, textAlign: 'center', lineHeight: 15, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 8, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: PINK },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
