// ============================================================
// BETWEEN US — PERIOD / CYCLE DATA LAYER
// src/lib/period.ts
//
// Shared cycle system:
// - Girlfriend can create/update/delete her own period data.
// - Partner can read the girlfriend's cycle data.
// - No privacy / visibility settings.
// - No share_symptoms / share_mood / share_flow settings.
// - The database RPC is responsible for returning partner data.
// ============================================================

import { supabase } from './supabase';

// ============================================================
// TYPES
// ============================================================

export type SymptomSeverity = 'mild' | 'moderate' | 'strong';

export type CyclePhase =
  | 'Period'
  | 'Follicular'
  | 'Ovulation'
  | 'Luteal';

export type PeriodSettings = {
  tracking_enabled: boolean;
  average_cycle_length: number;
  average_period_length: number;
};

export type PeriodLog = {
  id: string;
  start_date: string;
  end_date: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PeriodSymptom = {
  id: string;
  symptom_date: string;
  symptom_type: string;
  severity: SymptomSeverity;
  mood?: string | null;
  energy_level?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PartnerPeriodSummary = {
  latest_period_start: string | null;
  predicted_next_period: string | null;
  average_cycle_length: number;
  average_period_length: number;
  tracking_enabled?: boolean;
};

export type PeriodDashboard = {
  success: boolean;

  own: {
    settings: PeriodSettings;
    periods: PeriodLog[];
    symptoms: PeriodSymptom[];
  };

  partner: {
    settings?: PartnerPeriodSummary;
    periods: PeriodLog[];
    symptoms: PeriodSymptom[];
  } | null;
};

export type CurrentCycleInfo = {
  cycleDay: number | null;
  phase: CyclePhase;
  latestPeriod: PeriodLog | null;
  nextPeriod: string | null;
  ovulationDate: string | null;
  fertileWindow: {
    start: string | null;
    end: string | null;
  };
};

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_SETTINGS: PeriodSettings = {
  tracking_enabled: true,
  average_cycle_length: 28,
  average_period_length: 5,
};

// ============================================================
// DATE HELPERS
// ============================================================

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseDate(dateString: string): Date {
  return new Date(`${dateString}T12:00:00`);
}

export function getTodayString(): string {
  return formatDate(new Date());
}

export function addDays(dateString: string, days: number): string {
  const date = parseDate(dateString);
  date.setDate(date.getDate() + days);

  return formatDate(date);
}

export function daysBetween(
  startDate: string,
  endDate: string
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const difference = end.getTime() - start.getTime();

  return Math.round(
    difference / (1000 * 60 * 60 * 24)
  );
}

export function isDateInRange(
  date: string,
  start: string,
  end: string
): boolean {
  return date >= start && date <= end;
}

// ============================================================
// PERIOD HELPERS
// ============================================================

export function isDateInPeriod(
  date: string,
  period: PeriodLog,
  defaultLength: number = 5
): boolean {
  const start = period.start_date;

  /*
   * If no end date has been recorded yet,
   * temporarily use the configured average period length.
   */
  const end =
    period.end_date ||
    addDays(
      period.start_date,
      Math.max(1, defaultLength) - 1
    );

  return date >= start && date <= end;
}

export function sortPeriods(
  periods: PeriodLog[]
): PeriodLog[] {
  return [...periods].sort((a, b) =>
    b.start_date.localeCompare(a.start_date)
  );
}

export function getLatestPeriod(
  periods: PeriodLog[]
): PeriodLog | null {
  if (!periods.length) {
    return null;
  }

  return sortPeriods(periods)[0] || null;
}

export function getCycleDay(
  latestStart: string | null,
  today: string | null = getTodayString()
): number | null {
  if (!latestStart || !today) {
    return null;
  }

  return daysBetween(latestStart, today) + 1;
}

// ============================================================
// CYCLE PHASE
// ============================================================

export function getCyclePhase(
  cycleDay: number | null,
  averageCycleLength: number,
  averagePeriodLength: number
): CyclePhase {
  if (!cycleDay || cycleDay <= 0) {
    return 'Follicular';
  }

  const safeCycleLength =
    Number.isFinite(averageCycleLength) &&
    averageCycleLength > 0
      ? averageCycleLength
      : 28;

  const safePeriodLength =
    Number.isFinite(averagePeriodLength) &&
    averagePeriodLength > 0
      ? averagePeriodLength
      : 5;

  if (cycleDay <= safePeriodLength) {
    return 'Period';
  }

  const ovulationDay = Math.max(
    1,
    safeCycleLength - 14
  );

  if (Math.abs(cycleDay - ovulationDay) <= 1) {
    return 'Ovulation';
  }

  if (cycleDay < ovulationDay) {
    return 'Follicular';
  }

  return 'Luteal';
}

// ============================================================
// PHASE DESCRIPTION
// ============================================================

export function getPhaseDescription(
  phase: CyclePhase
): string {
  switch (phase) {
    case 'Period':
      return 'Your period is currently being tracked.';

    case 'Follicular':
      return 'Your body is moving through the follicular phase.';

    case 'Ovulation':
      return 'You are around your estimated ovulation window.';

    case 'Luteal':
      return 'Your body is in the luteal phase after estimated ovulation.';

    default:
      return 'Your current cycle phase is being estimated.';
  }
}

// ============================================================
// OVULATION / FERTILE WINDOW
// ============================================================

export function getEstimatedOvulationDate(
  latestStart: string | null,
  cycleLength: number
): string | null {
  if (!latestStart) {
    return null;
  }

  const safeCycleLength =
    Number.isFinite(cycleLength) &&
    cycleLength > 0
      ? cycleLength
      : 28;

  const ovulationOffset = Math.max(
    1,
    safeCycleLength - 14
  );

  return addDays(
    latestStart,
    ovulationOffset - 1
  );
}

export function getFertileWindow(
  latestStart: string | null,
  cycleLength: number
): {
  start: string | null;
  end: string | null;
} {
  if (!latestStart) {
    return {
      start: null,
      end: null,
    };
  }

  const ovulation = getEstimatedOvulationDate(
    latestStart,
    cycleLength
  );

  if (!ovulation) {
    return {
      start: null,
      end: null,
    };
  }

  return {
    start: addDays(ovulation, -5),
    end: addDays(ovulation, 1),
  };
}

// ============================================================
// NEXT PERIOD
// ============================================================

export function getPredictedNextPeriod(
  periods: PeriodLog[],
  cycleLength: number
): string | null {
  const latest = getLatestPeriod(periods);

  if (!latest) {
    return null;
  }

  const safeCycleLength =
    Number.isFinite(cycleLength) &&
    cycleLength > 0
      ? cycleLength
      : 28;

  return addDays(
    latest.start_date,
    safeCycleLength
  );
}

// ============================================================
// CURRENT CYCLE
// ============================================================

export function getCurrentCycleInfo(
  periods: PeriodLog[],
  settings: PeriodSettings | null | undefined
): CurrentCycleInfo {
  const safeSettings =
    settings || DEFAULT_SETTINGS;

  const latestPeriod =
    getLatestPeriod(periods);

  if (!latestPeriod) {
    return {
      cycleDay: null,
      phase: 'Follicular',
      latestPeriod: null,
      nextPeriod: null,
      ovulationDate: null,
      fertileWindow: {
        start: null,
        end: null,
      },
    };
  }

  const today = getTodayString();

  let cycleDay = getCycleDay(
    latestPeriod.start_date,
    today
  );

  /*
   * Never expose an invalid negative cycle day.
   */
  if (cycleDay !== null && cycleDay < 1) {
    cycleDay = null;
  }

  const phase = getCyclePhase(
    cycleDay,
    safeSettings.average_cycle_length,
    safeSettings.average_period_length
  );

  const nextPeriod =
    getPredictedNextPeriod(
      periods,
      safeSettings.average_cycle_length
    );

  const ovulationDate =
    getEstimatedOvulationDate(
      latestPeriod.start_date,
      safeSettings.average_cycle_length
    );

  const fertileWindow =
    getFertileWindow(
      latestPeriod.start_date,
      safeSettings.average_cycle_length
    );

  return {
    cycleDay,
    phase,
    latestPeriod,
    nextPeriod,
    ovulationDate,
    fertileWindow,
  };
}

// ============================================================
// CYCLE INFO FOR ANY DATE
// ============================================================

export function getCycleInfoForDate(
  periods: PeriodLog[],
  settings: PeriodSettings | null | undefined,
  date: string
): CurrentCycleInfo {
  const safeSettings =
    settings || DEFAULT_SETTINGS;

  const cycleLength =
    Number(safeSettings.average_cycle_length) ||
    28;

  const periodLength =
    Number(safeSettings.average_period_length) ||
    5;

  /*
   * Find the latest period that started on or before
   * the selected date.
   */
  const anchor =
    sortPeriods(periods).find(
      (period) =>
        period.start_date <= date
    ) || null;

  if (!anchor) {
    return {
      cycleDay: null,
      phase: 'Follicular',
      latestPeriod: null,
      nextPeriod: null,
      ovulationDate: null,
      fertileWindow: {
        start: null,
        end: null,
      },
    };
  }

  const rawDay =
    daysBetween(
      anchor.start_date,
      date
    ) + 1;

  /*
   * Wrap after the predicted cycle length so the calendar
   * continues showing a meaningful cycle day.
   */
  const cycleDay =
    rawDay > cycleLength
      ? ((rawDay - 1) % cycleLength) + 1
      : rawDay;

  const phase = getCyclePhase(
    cycleDay,
    cycleLength,
    periodLength
  );

  return {
    cycleDay,
    phase,
    latestPeriod: anchor,
    nextPeriod: getPredictedNextPeriod(
      periods,
      cycleLength
    ),
    ovulationDate:
      getEstimatedOvulationDate(
        anchor.start_date,
        cycleLength
      ),
    fertileWindow:
      getFertileWindow(
        anchor.start_date,
        cycleLength
      ),
  };
}

// ============================================================
// DASHBOARD NORMALIZATION
// ============================================================

function normalizeSettings(
  value:
    | Partial<PeriodSettings>
    | null
    | undefined
): PeriodSettings {
  const averageCycleLength =
    Number(value?.average_cycle_length);

  const averagePeriodLength =
    Number(value?.average_period_length);

  return {
    tracking_enabled:
      typeof value?.tracking_enabled === 'boolean'
        ? value.tracking_enabled
        : DEFAULT_SETTINGS.tracking_enabled,

    average_cycle_length:
      Number.isFinite(averageCycleLength) &&
      averageCycleLength >= 15 &&
      averageCycleLength <= 60
        ? averageCycleLength
        : DEFAULT_SETTINGS.average_cycle_length,

    average_period_length:
      Number.isFinite(averagePeriodLength) &&
      averagePeriodLength >= 1 &&
      averagePeriodLength <= 14
        ? averagePeriodLength
        : DEFAULT_SETTINGS.average_period_length,
  };
}

function normalizePeriod(
  value: any
): PeriodLog {
  return {
    id: String(value?.id || ''),
    start_date: String(
      value?.start_date || ''
    ),
    end_date:
      value?.end_date ?? null,
    notes:
      value?.notes ?? null,
    created_at:
      value?.created_at ?? null,
    updated_at:
      value?.updated_at ?? null,
  };
}

function normalizeSymptom(
  value: any
): PeriodSymptom {
  const severity: SymptomSeverity =
    value?.severity === 'moderate' ||
    value?.severity === 'strong'
      ? value.severity
      : 'mild';

  const energy =
    value?.energy_level === null ||
    value?.energy_level === undefined
      ? null
      : Number(value.energy_level);

  return {
    id: String(value?.id || ''),
    symptom_date: String(
      value?.symptom_date || ''
    ),
    symptom_type: String(
      value?.symptom_type || ''
    ),
    severity,
    mood:
      value?.mood ?? null,
    energy_level:
      Number.isFinite(energy)
        ? energy
        : null,
    created_at:
      value?.created_at ?? null,
    updated_at:
      value?.updated_at ?? null,
  };
}

function normalizePartnerSettings(
  value: any
): PartnerPeriodSummary | undefined {
  if (!value) {
    return undefined;
  }

  const averageCycleLength =
    Number(value?.average_cycle_length);

  const averagePeriodLength =
    Number(value?.average_period_length);

  return {
    latest_period_start:
      value?.latest_period_start ?? null,

    predicted_next_period:
      value?.predicted_next_period ?? null,

    average_cycle_length:
      Number.isFinite(averageCycleLength) &&
      averageCycleLength >= 15 &&
      averageCycleLength <= 60
        ? averageCycleLength
        : 28,

    average_period_length:
      Number.isFinite(averagePeriodLength) &&
      averagePeriodLength >= 1 &&
      averagePeriodLength <= 14
        ? averagePeriodLength
        : 5,

    tracking_enabled:
      typeof value?.tracking_enabled === 'boolean'
        ? value.tracking_enabled
        : true,
  };
}

// ============================================================
// GET PERIOD DASHBOARD
// ============================================================
//
// IMPORTANT:
//
// The database function `get_period_dashboard` is responsible
// for returning BOTH:
//   1. the current user's own data
//   2. their partner's data
//
// There is intentionally NO privacy filtering here.
//
// Therefore:
// GF inputs period/symptom
//        ↓
// Supabase
//        ↓
// get_period_dashboard()
//        ↓
// BF receives GF data
//
// The same function works in reverse if the account roles
// are the same or the other partner is the one entering data.
// ============================================================

export async function getPeriodDashboard(): Promise<PeriodDashboard> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_period_dashboard'
  );

  if (error) {
    throw error;
  }

  const raw = (data || {}) as any;

  const ownRaw =
    raw?.own || {};

  const partnerRaw =
    raw?.partner || null;

  const ownPeriods: PeriodLog[] =
    Array.isArray(ownRaw?.periods)
      ? ownRaw.periods.map(
          normalizePeriod
        )
      : [];

  const ownSymptoms: PeriodSymptom[] =
    Array.isArray(ownRaw?.symptoms)
      ? ownRaw.symptoms.map(
          normalizeSymptom
        )
      : [];

  let partner:
    PeriodDashboard['partner'] =
    null;

  if (partnerRaw) {
    const partnerPeriods: PeriodLog[] =
      Array.isArray(
        partnerRaw?.periods
      )
        ? partnerRaw.periods.map(
            normalizePeriod
          )
        : [];

    const partnerSymptoms: PeriodSymptom[] =
      Array.isArray(
        partnerRaw?.symptoms
      )
        ? partnerRaw.symptoms.map(
            normalizeSymptom
          )
        : [];

    partner = {
      settings:
        normalizePartnerSettings(
          partnerRaw?.settings
        ),

      periods:
        partnerPeriods,

      symptoms:
        partnerSymptoms,
    };
  }

  return {
    success:
      raw?.success !== false,

    own: {
      settings:
        normalizeSettings(
          ownRaw?.settings
        ),

      periods:
        ownPeriods,

      symptoms:
        ownSymptoms,
    },

    partner,
  };
}

// ============================================================
// SAVE PERIOD SETTINGS
// ============================================================
//
// Only actual cycle settings are saved.
// There are NO privacy parameters anymore.
// ============================================================

export async function savePeriodSettings(
  settings: PeriodSettings
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'save_period_settings',
    {
      p_tracking_enabled:
        settings.tracking_enabled,

      p_average_cycle_length:
        settings.average_cycle_length,

      p_average_period_length:
        settings.average_period_length,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// CREATE PERIOD
// ============================================================

export async function createPeriod(
  startDate: string,
  endDate: string | null,
  notes: string = ''
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'create_period_log',
    {
      p_start_date:
        startDate,

      p_end_date:
        endDate,

      p_notes:
        notes || null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// UPDATE PERIOD
// ============================================================

export async function updatePeriod(
  id: string,
  startDate: string,
  endDate: string | null,
  notes: string = ''
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'update_period_log',
    {
      p_id:
        id,

      p_start_date:
        startDate,

      p_end_date:
        endDate,

      p_notes:
        notes || null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// DELETE PERIOD
// ============================================================

export async function deletePeriod(
  id: string
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'delete_period_log',
    {
      p_id:
        id,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// SAVE SYMPTOM
// ============================================================

export type SavePeriodSymptomInput = {
  symptomDate: string;
  symptomType: string;
  severity: SymptomSeverity;
  mood?: string | null;
  energyLevel?: number | null;
};

export async function savePeriodSymptom(
  input: SavePeriodSymptomInput
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'save_period_symptom',
    {
      p_symptom_date:
        input.symptomDate,

      p_symptom_type:
        input.symptomType,

      p_severity:
        input.severity,

      p_mood:
        input.mood ?? null,

      p_energy_level:
        input.energyLevel ?? null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// DELETE SYMPTOM
// ============================================================

export async function deletePeriodSymptom(
  id: string
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'delete_period_symptom',
    {
      p_id:
        id,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// FIND SYMPTOMS FOR A DATE
// ============================================================

export function getSymptomsForDate(
  symptoms: PeriodSymptom[],
  date: string
): PeriodSymptom[] {
  return symptoms.filter(
    (symptom) =>
      symptom.symptom_date === date
  );
}

// ============================================================
// FIND SYMPTOMS FOR TODAY
// ============================================================

export function getTodaySymptoms(
  symptoms: PeriodSymptom[]
): PeriodSymptom[] {
  return getSymptomsForDate(
    symptoms,
    getTodayString()
  );
}

// ============================================================
// CYCLE LENGTH FROM HISTORY
// ============================================================

export function calculateAverageCycleLength(
  periods: PeriodLog[]
): number {
  const sorted =
    sortPeriods(periods);

  if (sorted.length < 2) {
    return 28;
  }

  const intervals: number[] = [];

  for (
    let i = 0;
    i < sorted.length - 1;
    i++
  ) {
    const current =
      sorted[i];

    const previous =
      sorted[i + 1];

    const difference =
      daysBetween(
        previous.start_date,
        current.start_date
      );

    if (
      difference >= 15 &&
      difference <= 60
    ) {
      intervals.push(
        difference
      );
    }
  }

  if (!intervals.length) {
    return 28;
  }

  const average =
    intervals.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / intervals.length;

  return Math.round(
    average
  );
}

// ============================================================
// PERIOD LENGTH
// ============================================================

export function calculatePeriodLength(
  period: PeriodLog
): number | null {
  if (!period.end_date) {
    return null;
  }

  return (
    daysBetween(
      period.start_date,
      period.end_date
    ) + 1
  );
}

// ============================================================
// SAFE CYCLE DAY
// ============================================================

export function getSafeCycleDay(
  latestStart: string | null,
  today: string | null = getTodayString()
): number | null {
  const day =
    getCycleDay(
      latestStart,
      today
    );

  if (
    day === null ||
    day < 1
  ) {
    return null;
  }

  return day;
}

// ============================================================
// CHECK ESTIMATED FERTILE DATE
// ============================================================

export function isEstimatedFertileDate(
  date: string,
  latestStart: string | null,
  cycleLength: number
): boolean {
  const window =
    getFertileWindow(
      latestStart,
      cycleLength
    );

  if (
    !window.start ||
    !window.end
  ) {
    return false;
  }

  return (
    date >= window.start &&
    date <= window.end
  );
}

// ============================================================
// CHECK ESTIMATED OVULATION
// ============================================================

export function isEstimatedOvulationDate(
  date: string,
  latestStart: string | null,
  cycleLength: number
): boolean {
  const ovulation =
    getEstimatedOvulationDate(
      latestStart,
      cycleLength
    );

  return (
    !!ovulation &&
    ovulation === date
  );
}

// ============================================================
// FORMAT PHASE
// ============================================================

export function formatPhase(
  phase: CyclePhase
): string {
  return phase;
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  getPeriodDashboard,
  savePeriodSettings,
  createPeriod,
  updatePeriod,
  deletePeriod,
  savePeriodSymptom,
  deletePeriodSymptom,
  getCurrentCycleInfo,
  getCycleInfoForDate,
  getCycleDay,
  getCyclePhase,
  getPredictedNextPeriod,
  getEstimatedOvulationDate,
  getFertileWindow,
  getLatestPeriod,
  getSymptomsForDate,
  getTodaySymptoms,
  calculateAverageCycleLength,
  calculatePeriodLength,
  getSafeCycleDay,
  isEstimatedFertileDate,
  isEstimatedOvulationDate,
  formatPhase,
};