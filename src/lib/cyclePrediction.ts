import type {
    CyclePhase,
    PeriodLog,
    PeriodSettings,
} from './period';

/**
 * Between Us — Personalized Cycle Prediction Engine
 *
 * This module contains NO UI and NO Supabase calls.
 * It converts logged period history + settings into estimates.
 *
 * Prediction strategy:
 * 1. Calculate cycle intervals from actual period-start history.
 * 2. Detect obvious interval outliers with IQR.
 * 3. Give more weight to the most recent usable cycles.
 * 4. Blend the recent weighted average with the median.
 * 5. Use the result to estimate the next period and cycle phase.
 *
 * Important:
 * - Predictions are estimates, not guarantees.
 * - Actual logged history takes priority over a configured average
 *   once usable cycle history exists.
 * - Irregular cycles intentionally produce wider prediction windows.
 * - Fertile/ovulation dates are especially uncertain when cycles
 *   are irregular and should never be presented as contraception.
 */

export type PredictionConfidence =
  | 'low'
  | 'moderate'
  | 'higher';

export type CycleHistoryStats = {
  cycleLengths: number[];
  typicalCycleLength: number | null;
  medianCycleLength: number | null;
  averageCycleLength: number | null;
  shortestCycleLength: number | null;
  longestCycleLength: number | null;
  variabilityDays: number | null;
  variabilityLabel:
    | 'not enough data'
    | 'low'
    | 'moderate'
    | 'high';
  outlierCycleLengths: number[];
  usableCycleLengths: number[];
};

export type CyclePrediction = {
  nextPeriodDate: string | null;
  nextPeriodWindowStart: string | null;
  nextPeriodWindowEnd: string | null;

  cycleDay: number | null;
  cycleLengthUsed: number | null;

  phase: CyclePhase | null;

  ovulationDate: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;

  confidence: PredictionConfidence;
  confidenceLabel: string;

  historyCount: number;
  cycleRangeLabel: string;
  summary: string;
};

const MIN_CYCLE = 15;
const MAX_CYCLE = 60;
const MIN_PERIOD = 1;
const MAX_PERIOD = 14;

/**
 * Only the most recent usable cycles are used for the
 * short-term personalized weighted average.
 *
 * Five cycles gives enough recent history without allowing
 * very old history to dominate the immediate prediction.
 */
const RECENT_CYCLE_LIMIT = 5;

/**
 * Median is intentionally given slightly more influence than
 * the recent weighted average because median is more resistant
 * to unusual values.
 */
const MEDIAN_WEIGHT = 0.55;
const RECENT_WEIGHT = 0.45;

function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return formatDate(date);
}

function daysBetween(start: string, end: string): number {
  const a = parseDate(start).getTime();
  const b = parseDate(end).getTime();

  return Math.round(
    (b - a) / (1000 * 60 * 60 * 24)
  );
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round(
      (sorted[middle - 1] + sorted[middle]) / 2
    );
  }

  return sorted[middle];
}

function mean(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function standardDeviation(
  values: number[]
): number | null {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);

  if (average === null) {
    return null;
  }

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - average, 2),
      0
    ) / values.length;

  return Math.sqrt(variance);
}

function uniqueSortedPeriodDates(
  periods: PeriodLog[]
): string[] {
  return Array.from(
    new Set(
      periods
        .map((period) => period.start_date)
        .filter(Boolean)
    )
  ).sort();
}

/**
 * Returns the cycle length between consecutive period starts.
 *
 * Example:
 * Aug 1 → Sep 5 = 35 days
 */
export function getCycleLengths(
  periods: PeriodLog[]
): number[] {
  const dates = uniqueSortedPeriodDates(periods);
  const result: number[] = [];

  for (let index = 1; index < dates.length; index += 1) {
    const length = daysBetween(
      dates[index - 1],
      dates[index]
    );

    if (
      length >= MIN_CYCLE &&
      length <= MAX_CYCLE
    ) {
      result.push(length);
    }
  }

  return result;
}

/**
 * Detect extreme cycle intervals using the IQR method.
 *
 * A cycle is only treated as an outlier when there is enough
 * history and it falls clearly outside the normal distribution
 * of the user's logged intervals.
 */
function getOutlierValues(
  values: number[]
): number[] {
  if (values.length < 4) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);

  const q1Index = Math.floor(
    (sorted.length - 1) * 0.25
  );

  const q3Index = Math.floor(
    (sorted.length - 1) * 0.75
  );

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  if (iqr <= 0) {
    return [];
  }

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return values.filter(
    (value) =>
      value < lower ||
      value > upper
  );
}

export function analyzeCycleHistory(
  periods: PeriodLog[]
): CycleHistoryStats {
  const cycleLengths = getCycleLengths(periods);

  const outlierCycleLengths =
    getOutlierValues(cycleLengths);

  const usableCycleLengths =
    cycleLengths.filter(
      (value) =>
        !outlierCycleLengths.includes(value)
    );

  /**
   * Never throw away almost all of the user's history.
   * If outlier removal leaves fewer than two usable cycles,
   * use all valid intervals instead.
   */
  const effectiveValues =
    usableCycleLengths.length >= 2
      ? usableCycleLengths
      : cycleLengths;

  const medianCycleLength =
    median(effectiveValues);

  const averageCycleLength =
    mean(effectiveValues);

  const shortestCycleLength =
    effectiveValues.length
      ? Math.min(...effectiveValues)
      : null;

  const longestCycleLength =
    effectiveValues.length
      ? Math.max(...effectiveValues)
      : null;

  const variabilityDays =
    standardDeviation(effectiveValues);

  let variabilityLabel:
    CycleHistoryStats['variabilityLabel'] =
    'not enough data';

  if (variabilityDays !== null) {
    if (variabilityDays <= 2) {
      variabilityLabel = 'low';
    } else if (variabilityDays <= 5) {
      variabilityLabel = 'moderate';
    } else {
      variabilityLabel = 'high';
    }
  }

  return {
    cycleLengths,
    typicalCycleLength:
      medianCycleLength,
    medianCycleLength,
    averageCycleLength,
    shortestCycleLength,
    longestCycleLength,
    variabilityDays,
    variabilityLabel,
    outlierCycleLengths,
    usableCycleLengths: effectiveValues,
  };
}

/**
 * Calculates a recent-cycle weighted average.
 *
 * The newest usable interval gets the largest weight:
 *
 * oldest → newest
 *   1        5
 *
 * Example with 5 recent cycles:
 * 32×1 + 35×2 + 30×3 + 42×4 + 34×5
 * --------------------------------------
 *              1+2+3+4+5
 *
 * This makes the estimate responsive to recent changes while
 * still retaining several previous cycles.
 */
export function getRecentWeightedAverage(
  cycleLengths: number[],
  limit: number = RECENT_CYCLE_LIMIT
): number | null {
  if (!cycleLengths.length) {
    return null;
  }

  const safeLimit = Math.max(
    1,
    Math.floor(limit)
  );

  const recent =
    cycleLengths.slice(-safeLimit);

  let weightedTotal = 0;
  let weightTotal = 0;

  recent.forEach((value, index) => {
    const weight = index + 1;

    weightedTotal +=
      value * weight;

    weightTotal += weight;
  });

  if (weightTotal === 0) {
    return null;
  }

  return (
    weightedTotal /
    weightTotal
  );
}

/**
 * Returns a personalized cycle length.
 *
 * Priority:
 * 1. Real logged cycle history.
 * 2. Recent weighted behavior.
 * 3. Median stabilization.
 * 4. Settings average only when there is no usable history.
 *
 * This deliberately does NOT simply use the settings value once
 * actual history is available.
 */
export function getPersonalizedCycleLength(
  periods: PeriodLog[],
  settings?: Partial<PeriodSettings> | null
): number | null {
  const lengths =
    getCycleLengths(periods);

  /**
   * No measured cycle yet:
   * use the user's configured baseline as a fallback.
   */
  if (!lengths.length) {
    const configured =
      Number(
        settings?.average_cycle_length
      );

    if (
      Number.isFinite(configured) &&
      configured >= MIN_CYCLE &&
      configured <= MAX_CYCLE
    ) {
      return Math.round(configured);
    }

    return null;
  }

  const stats =
    analyzeCycleHistory(periods);

  const usable =
    stats.usableCycleLengths;

  if (!usable.length) {
    const configured =
      Number(
        settings?.average_cycle_length ?? 28
      );

    return Math.round(
      clamp(
        Number.isFinite(configured)
          ? configured
          : 28,
        MIN_CYCLE,
        MAX_CYCLE
      )
    );
  }

  /**
   * With only one measured interval, the observed interval
   * is the only real personalized signal available.
   */
  if (usable.length === 1) {
    return Math.round(
      clamp(
        usable[0],
        MIN_CYCLE,
        MAX_CYCLE
      )
    );
  }

  const recentWeightedAverage =
    getRecentWeightedAverage(
      usable,
      RECENT_CYCLE_LIMIT
    );

  const medianValue =
    stats.medianCycleLength;

  /**
   * If either statistic is unexpectedly unavailable, use the
   * statistic that exists instead of producing NaN.
   */
  if (
    recentWeightedAverage === null &&
    medianValue === null
  ) {
    return null;
  }

  if (
    recentWeightedAverage === null
  ) {
    return Math.round(
      clamp(
        medianValue as number,
        MIN_CYCLE,
        MAX_CYCLE
      )
    );
  }

  if (medianValue === null) {
    return Math.round(
      clamp(
        recentWeightedAverage,
        MIN_CYCLE,
        MAX_CYCLE
      )
    );
  }

  /**
   * Median protects against sudden unusual values.
   * Recent weighted average allows the prediction to adapt
   * when the user's cycle is genuinely changing.
   */
  const personalized =
    medianValue * MEDIAN_WEIGHT +
    recentWeightedAverage * RECENT_WEIGHT;

  return Math.round(
    clamp(
      personalized,
      MIN_CYCLE,
      MAX_CYCLE
    )
  );
}

export function getPredictionConfidence(
  periods: PeriodLog[],
  _settings?: Partial<PeriodSettings> | null
): PredictionConfidence {
  const historyCount =
    uniqueSortedPeriodDates(periods).length;

  const stats =
    analyzeCycleHistory(periods);

  if (historyCount < 3) {
    return 'low';
  }

  if (
    historyCount >= 6 &&
    stats.variabilityLabel === 'low'
  ) {
    return 'higher';
  }

  if (
    historyCount >= 5 &&
    stats.variabilityLabel !== 'high'
  ) {
    return 'higher';
  }

  /**
   * High variability should keep confidence conservative
   * even when the user has several records.
   */
  if (
    historyCount >= 4 &&
    stats.variabilityLabel === 'high'
  ) {
    return 'moderate';
  }

  return 'moderate';
}

export function getConfidenceLabel(
  confidence: PredictionConfidence
): string {
  switch (confidence) {
    case 'higher':
      return 'Higher confidence';

    case 'moderate':
      return 'Moderate confidence';

    default:
      return 'Early estimate';
  }
}

function getLatestPeriod(
  periods: PeriodLog[]
): PeriodLog | null {
  const sorted = [...periods]
    .filter(
      (period) =>
        Boolean(period.start_date)
    )
    .sort((a, b) =>
      b.start_date.localeCompare(
        a.start_date
      )
    );

  return sorted[0] ?? null;
}

function getPeriodLength(
  period: PeriodLog | null,
  settings?: Partial<PeriodSettings> | null
): number {
  if (
    period?.start_date &&
    period.end_date
  ) {
    const measured =
      daysBetween(
        period.start_date,
        period.end_date
      ) + 1;

    if (
      measured >= MIN_PERIOD &&
      measured <= MAX_PERIOD
    ) {
      return measured;
    }
  }

  const configured =
    Number(
      settings?.average_period_length ?? 5
    );

  return Math.round(
    clamp(
      Number.isFinite(configured)
        ? configured
        : 5,
      MIN_PERIOD,
      MAX_PERIOD
    )
  );
}

export function getCycleDayForDate(
  periodStart: string | null,
  date: string,
  cycleLength: number | null
): number | null {
  if (!periodStart) {
    return null;
  }

  const difference =
    daysBetween(
      periodStart,
      date
    );

  if (difference < 0) {
    return null;
  }

  if (cycleLength === null) {
    return difference + 1;
  }

  return (
    (difference % cycleLength) + 1
  );
}

export function getPhaseForCycleDay(
  cycleDay: number | null,
  periodLength: number,
  cycleLength: number | null
): CyclePhase | null {
  if (cycleDay === null) {
    return null;
  }

  const cycle =
    cycleLength ?? 28;

  if (cycleDay <= periodLength) {
    return 'Period';
  }

  /**
   * Ovulation is estimated approximately 14 days before
   * the next expected period. This is an estimate only.
   */
  const ovulationDay =
    Math.max(
      periodLength + 1,
      cycle - 14
    );

  if (
    Math.abs(
      cycleDay - ovulationDay
    ) <= 1
  ) {
    return 'Ovulation';
  }

  if (
    cycleDay < ovulationDay
  ) {
    return 'Follicular';
  }

  return 'Luteal';
}

export function getCycleRangeLabel(
  stats: CycleHistoryStats
): string {
  if (
    stats.shortestCycleLength === null ||
    stats.longestCycleLength === null
  ) {
    return 'Not enough history yet';
  }

  if (
    stats.shortestCycleLength ===
    stats.longestCycleLength
  ) {
    return `${stats.shortestCycleLength} days`;
  }

  return `${stats.shortestCycleLength}–${stats.longestCycleLength} days`;
}

/**
 * Builds the complete personalized prediction.
 */
export function predictCycle(
  periods: PeriodLog[],
  settings?: Partial<PeriodSettings> | null,
  today?: string
): CyclePrediction {
  const latest =
    getLatestPeriod(periods);

  const stats =
    analyzeCycleHistory(periods);

  if (!latest) {
    return {
      nextPeriodDate: null,
      nextPeriodWindowStart: null,
      nextPeriodWindowEnd: null,
      cycleDay: null,
      cycleLengthUsed: null,
      phase: null,
      ovulationDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      confidence: 'low',
      confidenceLabel: 'Early estimate',
      historyCount: 0,
      cycleRangeLabel:
        'Not enough history yet',
      summary:
        'Log your first period to begin personalized estimates.',
    };
  }

  const referenceDate =
    today ??
    formatDate(new Date());

  const cycleLength =
    getPersonalizedCycleLength(
      periods,
      settings
    );

  const confidence =
    getPredictionConfidence(
      periods,
      settings
    );

  const confidenceLabel =
    getConfidenceLabel(
      confidence
    );

  const periodLength =
    getPeriodLength(
      latest,
      settings
    );

  const cycleDay =
    getCycleDayForDate(
      latest.start_date,
      referenceDate,
      cycleLength
    );

  const phase =
    getPhaseForCycleDay(
      cycleDay,
      periodLength,
      cycleLength
    );

  if (cycleLength === null) {
    return {
      nextPeriodDate: null,
      nextPeriodWindowStart: null,
      nextPeriodWindowEnd: null,
      cycleDay,
      cycleLengthUsed: null,
      phase,
      ovulationDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      confidence,
      confidenceLabel,
      historyCount:
        uniqueSortedPeriodDates(
          periods
        ).length,
      cycleRangeLabel:
        getCycleRangeLabel(stats),
      summary:
        'Add more period history to create a personalized prediction.',
    };
  }

  const predictedNextPeriod =
    addDays(
      latest.start_date,
      cycleLength
    );

  /**
   * Prediction window:
   * - regular history → narrower
   * - moderate variation → wider
   * - high variation → widest
   * - little history → conservative window
   */
  let windowDays = 2;

  if (
    stats.variabilityLabel ===
    'moderate'
  ) {
    windowDays = 3;
  }

  if (
    stats.variabilityLabel ===
    'high'
  ) {
    windowDays = 5;
  }

  if (confidence === 'low') {
    windowDays = Math.max(
      windowDays,
      4
    );
  }

  const nextPeriodWindowStart =
    addDays(
      predictedNextPeriod,
      -windowDays
    );

  const nextPeriodWindowEnd =
    addDays(
      predictedNextPeriod,
      windowDays
    );

  /**
   * Ovulation estimate:
   * approximately 14 days before the predicted next period.
   */
  const ovulationDate =
    addDays(
      predictedNextPeriod,
      -14
    );

  /**
   * Informational fertile window only.
   * Never present this as a contraception method.
   */
  const fertileWindowStart =
    addDays(
      ovulationDate,
      -5
    );

  const fertileWindowEnd =
    addDays(
      ovulationDate,
      1
    );

  const range =
    getCycleRangeLabel(stats);

  let summary =
    `Your recent cycles range from ${range}.`;

  if (
    stats.variabilityLabel ===
    'high'
  ) {
    summary +=
      ' Your cycle varies quite a bit, so the prediction window is wider.';
  } else if (
    stats.variabilityLabel ===
    'moderate'
  ) {
    summary +=
      ' Your cycle has some variation, so dates are shown as estimates.';
  } else if (
    stats.cycleLengths.length >= 2
  ) {
    summary +=
      ' Your recent history is being used to personalize the estimate.';
  } else {
    summary =
      ' This is an early estimate and will become more personalized as you log more cycles.';
  }

  return {
    nextPeriodDate:
      predictedNextPeriod,

    nextPeriodWindowStart,

    nextPeriodWindowEnd,

    cycleDay,

    cycleLengthUsed:
      cycleLength,

    phase,

    ovulationDate,

    fertileWindowStart,

    fertileWindowEnd,

    confidence,

    confidenceLabel,

    historyCount:
      uniqueSortedPeriodDates(
        periods
      ).length,

    cycleRangeLabel:
      range,

    summary,
  };
}

/**
 * Convenience formatter for UI:
 * "Oct 31 – Nov 7"
 */
export function formatPredictionWindow(
  start: string | null,
  end: string | null
): string {
  if (!start || !end) {
    return 'Not enough data';
  }

  const startDate =
    parseDate(start);

  const endDate =
    parseDate(end);

  const startText =
    startDate.toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric',
      }
    );

  const endText =
    endDate.toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    );

  return `${startText} – ${endText}`;
}

export function formatCycleRange(
  stats: CycleHistoryStats
): string {
  return getCycleRangeLabel(stats);
}

export function getPredictionDisclosure(): string {
  return 'Cycle dates are estimates based on logged history. They can be less accurate when cycles are irregular and should not be used as contraception.';
}

export default {
  getCycleLengths,
  analyzeCycleHistory,
  getRecentWeightedAverage,
  getPersonalizedCycleLength,
  getPredictionConfidence,
  getConfidenceLabel,
  getCycleDayForDate,
  getPhaseForCycleDay,
  getCycleRangeLabel,
  predictCycle,
  formatPredictionWindow,
  formatCycleRange,
  getPredictionDisclosure,
};
