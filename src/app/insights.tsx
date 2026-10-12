import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import CycleTabBar from '../components/CycleTabBar';
import { useCycleDashboard } from '../hooks/use-cycle-dashboard';
import { calculateAverageCycleLength, calculatePeriodLength, getCurrentCycleInfo, getCycleInfoForDate, getPredictedNextPeriod, PeriodLog } from '../lib/period';
import { SharedDailyWellness, getSharedDailyWellness } from '../lib/cycleFeatures';
import { countPartnerMessagesSentSince } from '../lib/partnerMessages';
import { Screen } from '../lib/ui';

const PINK = '#F4768F';
const PURPLE = '#A58BE0';
const PEACH = '#F29A82';
const TEXT = '#282638';
const MUTED = '#84808D';
const dateLabel = (value: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : 'Not enough data';

export default function InsightsScreen() {
  const { loading, error, viewerMode, periods, symptoms, settings, reload } = useCycleDashboard();
  const sorted = useMemo(() => [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date)), [periods]);
  const cycle = getCurrentCycleInfo(periods, settings);
  const predictedNext = getPredictedNextPeriod(periods, settings.average_cycle_length);
  const averageCycle = sorted.length > 1 ? calculateAverageCycleLength(periods) : settings.average_cycle_length;
  const completedLengths = sorted.map((period) => calculatePeriodLength(period)).filter((value): value is number => value !== null);
  const averagePeriod = completedLengths.length
    ? Math.round(completedLengths.reduce((sum, value) => sum + value, 0) / completedLengths.length)
    : settings.average_period_length;
  const topSymptoms = useMemo(() => {
    const counts = new Map<string, number>();
    symptoms.forEach(({ symptom_type }) => counts.set(symptom_type, (counts.get(symptom_type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [symptoms]);
  const phaseLabel = cycle.cycleDay ? cycle.phase : 'No cycle data';
  const periodHistory = sorted.slice(0, 5);
  const [dailyLogs, setDailyLogs] = useState<SharedDailyWellness[]>([]);
  const [fertileMode, setFertileMode] = useState(false);
  const [monthMessageCount, setMonthMessageCount] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const [logs, mode, sentCount] = await Promise.all([
          getSharedDailyWellness(),
          AsyncStorage.getItem('@betweenus_fertile_window_mode_v1'),
          countPartnerMessagesSentSince(monthStart).catch(() => 0),
        ]);
        if (!active) return;
        setDailyLogs(logs);
        setFertileMode(mode === 'on');
        setMonthMessageCount(sentCount);
      } catch { /* Empty state remains available while offline. */ }
    })();
    return () => { active = false; };
  }, []);
  const symptomHeat = useMemo(() => {
    const counts = new Map<number, number>();
    symptoms.forEach((item) => {
      const day = getCycleInfoForDate(periods, settings, item.symptom_date).cycleDay;
      if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [symptoms, periods, settings]);
  const moodByPhase = useMemo(() => {
    const totals = new Map<string, { energy: number; count: number }>();
    dailyLogs.forEach((log) => {
      if (log.energy_level == null) return;
      const phase = getCycleInfoForDate(periods, settings, log.log_date).phase;
      const total = totals.get(phase) ?? { energy: 0, count: 0 };
      total.energy += log.energy_level; total.count += 1; totals.set(phase, total);
    });
    return [...totals.entries()];
  }, [dailyLogs, periods, settings]);
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLogs = dailyLogs.filter((log) => log.log_date.startsWith(monthKey)).length;
  const currentMonthSymptoms = symptoms.filter((item) => item.symptom_date.startsWith(monthKey)).length;

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to period tracker" onPress={() => router.replace('/period' as any)} style={styles.back}>
            <Ionicons name="arrow-back" size={21} color={TEXT} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Cycle Insights</Text>
            <Text style={styles.subtitle}>{viewerMode ? "Her cycle patterns" : 'Your cycle patterns'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh insights" onPress={reload} style={styles.back}>
            <Ionicons name="refresh-outline" size={20} color={TEXT} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={PINK} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.sectionTitle}>Could not load insights</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={reload} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.phaseCard}>
              <View style={styles.phaseIcon}><Ionicons name="sparkles-outline" size={22} color={PURPLE} /></View>
              <Text style={styles.kicker}>{viewerMode ? 'HER CURRENT PHASE' : 'CURRENT PHASE'}</Text>
              <Text style={styles.phaseTitle}>{phaseLabel}</Text>
              <Text style={styles.phaseSubtitle}>
                {cycle.cycleDay
                  ? `Cycle day ${cycle.cycleDay} · ${viewerMode ? 'shared from her tracker' : 'based on your logged dates'}`
                  : viewerMode
                    ? 'Her cycle insights will appear when she logs a period.'
                    : 'Log a period to start seeing cycle insights.'}
              </Text>
            </View>

            <View style={styles.metrics}>
              <Metric icon="repeat-outline" label={sorted.length > 1 ? 'Avg. cycle' : 'Cycle length'} value={`${averageCycle} days`} color={PURPLE} />
              <Metric icon="water-outline" label={completedLengths.length ? 'Avg. period' : 'Period length'} value={`${averagePeriod} days`} color={PINK} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Coming up</Text>
              <InsightRow icon="calendar-outline" label="Next expected period" value={dateLabel(predictedNext)} color={PINK} />
              <InsightRow icon="flower-outline" label="Estimated ovulation" value={dateLabel(cycle.ovulationDate)} color={PEACH} />
              {viewerMode || fertileMode ? <InsightRow icon="leaf-outline" label="Fertile window" value={cycle.fertileWindow.start && cycle.fertileWindow.end ? `${dateLabel(cycle.fertileWindow.start)} – ${dateLabel(cycle.fertileWindow.end)}` : 'Not enough data'} color="#74A989" last /> : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>Period history</Text>
                <Text style={styles.count}>{periods.length} {periods.length === 1 ? 'log' : 'logs'}</Text>
              </View>
              {periodHistory.length ? periodHistory.map((period) => <HistoryRow key={period.id} period={period} />) : (
                <Text style={styles.muted}>{viewerMode ? 'Her period logs will appear here when she adds them.' : 'Your period history will appear here after you log a period.'}</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>Symptom patterns</Text>
                <Text style={styles.count}>{symptoms.length} {symptoms.length === 1 ? 'entry' : 'entries'}</Text>
              </View>
              {topSymptoms.length ? topSymptoms.map(([name, count]) => (
                <View key={name} style={styles.symptomRow}>
                  <View style={styles.symptomNameWrap}><View style={styles.symptomDot} /><Text style={styles.rowLabel}>{name}</Text></View>
                  <Text style={styles.rowValue}>{count} {count === 1 ? 'time' : 'times'}</Text>
                </View>
              )) : <Text style={styles.muted}>{viewerMode ? 'Shared symptom trends will appear once she logs symptoms.' : 'Symptom trends will appear after you log symptoms.'}</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Symptom heatmap · cycle day</Text>
              {symptomHeat.length ? <View style={styles.heatmap}>{symptomHeat.map(([day, count]) => <View key={day} style={[styles.heatCell, { opacity: Math.min(1, 0.35 + count * 0.2) }]}><Text style={styles.heatCount}>{count}</Text><Text style={styles.heatDay}>D{day}</Text></View>)}</View> : <Text style={styles.muted}>Log symptoms to see which cycle days tend to have symptoms.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mood and energy by phase</Text>
              {moodByPhase.length ? moodByPhase.map(([phase, total]) => <InsightRow key={phase} icon="pulse-outline" label={phase} value={`${(total.energy / total.count).toFixed(1)}/5 energy · ${total.count} logs`} color={PURPLE} />) : <Text style={styles.muted}>{viewerMode ? 'Her shared mood and energy patterns will appear as she logs.' : 'Mood and energy patterns will appear as you log across cycles.'}</Text>}
            </View>

            {!viewerMode ? <View style={styles.card}>
              <View style={styles.insightRow}><Text style={styles.sectionTitle}>Fertile window mode</Text><Switch value={fertileMode} onValueChange={(value) => { setFertileMode(value); void AsyncStorage.setItem('@betweenus_fertile_window_mode_v1', value ? 'on' : 'off'); }} trackColor={{ true: '#D6C9F0' }} thumbColor={fertileMode ? PURPLE : '#FFFFFF'} /></View>
              <Text style={styles.muted}>{fertileMode ? 'Planning and awareness estimates are on. These estimates are not reliable contraception.' : 'Turn on to display estimated fertile-window information.'}</Text>
            </View> : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>This month</Text>
              <InsightRow icon="heart-outline" label="Daily logs" value={`${currentMonthLogs}`} color={PINK} />
              <InsightRow icon="pulse-outline" label="Symptoms logged" value={`${currentMonthSymptoms}`} color={PURPLE} />
              <InsightRow icon="mail-outline" label="Messages sent" value={`${monthMessageCount}`} color={PEACH} last />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Phase-based care</Text>
              <Text style={styles.muted}>{cycle.phase === 'Luteal' ? 'Luteal · Try a gentle walk, stretching, or a lighter workout if that feels better.' : cycle.phase === 'Period' ? 'Period · Rest or choose gentle movement based on how you feel.' : cycle.phase === 'Ovulation' ? 'Ovulation · Choose movement that feels comfortable; energy can vary.' : 'Follicular · Gradually build activity if your energy is increasing.'}</Text>
            </View>

            <Text style={styles.footnote}>Cycle dates are estimates based on logged history. Calendar-based ovulation and fertile-window predictions can be wrong and should never be used to prevent pregnancy.</Text>
          </ScrollView>
        )}
        <CycleTabBar active="insights" />
      </View>
    </Screen>
  );
}

function Metric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={18} color={color} /></View><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function InsightRow({ icon, label, value, color, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string; last?: boolean }) {
  return <View style={[styles.insightRow, !last && styles.rowBorder]}><Ionicons name={icon} size={18} color={color} /><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

function HistoryRow({ period }: { period: PeriodLog }) {
  const start = dateLabel(period.start_date);
  const end = period.end_date ? dateLabel(period.end_date) : 'Ongoing / not ended';
  const length = calculatePeriodLength(period);
  return <View style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name="calendar-outline" size={17} color={PINK} /></View><View style={styles.historyText}><Text style={styles.rowLabel}>{start}</Text><Text style={styles.historySub}>{end}{length ? ` · ${length} days` : ''}</Text></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFDFD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2E8EB' },
  headerText: { flex: 1 },
  title: { fontSize: 21, fontWeight: '700', color: TEXT },
  subtitle: { marginTop: 2, fontSize: 12, color: MUTED },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20, gap: 13 },
  phaseCard: { alignItems: 'center', padding: 21, borderRadius: 24, backgroundColor: '#F7F3FD', borderWidth: 1, borderColor: '#E9E2F8' },
  phaseIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kicker: { color: PURPLE, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  phaseTitle: { color: TEXT, fontSize: 24, fontWeight: '700', marginTop: 5 },
  phaseSubtitle: { color: MUTED, fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2E8EB', borderRadius: 20, padding: 14 },
  metricIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricLabel: { color: MUTED, fontSize: 10 },
  metricValue: { color: TEXT, fontSize: 17, fontWeight: '700', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2E8EB', borderRadius: 21, padding: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 7 },
  count: { color: MUTED, fontSize: 10, marginBottom: 7 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 43 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5EFF1' },
  rowLabel: { flex: 1, color: TEXT, fontSize: 11, fontWeight: '500' },
  rowValue: { color: TEXT, fontSize: 10, fontWeight: '600', textAlign: 'right', maxWidth: '48%' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  historyIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF0F3' },
  historyText: { flex: 1 },
  historySub: { color: MUTED, fontSize: 10, marginTop: 2 },
  symptomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F5EFF1' },
  symptomNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  symptomDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PURPLE },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  heatCell: { width: 42, height: 48, borderRadius: 12, backgroundColor: '#F0EBFB', alignItems: 'center', justifyContent: 'center' },
  heatCount: { color: PURPLE, fontSize: 14, fontWeight: '700' },
  heatDay: { color: MUTED, fontSize: 9 },
  muted: { color: MUTED, fontSize: 11, lineHeight: 17 },
  footnote: { color: MUTED, fontSize: 10, textAlign: 'center', lineHeight: 15, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  retry: { marginTop: 8, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: PINK },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
