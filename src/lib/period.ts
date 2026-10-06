// ============================================================
// BETWEEN US — PERIOD / CYCLE DATA LAYER
// src/lib/period.ts
// ============================================================

import { supabase } from './supabase';

// ============================================================
// TYPES
// ============================================================

export type PeriodVisibility =
  | 'private'
  | 'summary'
  | 'full';

export type SymptomSeverity =
  | 'mild'
  | 'moderate'
  | 'strong';

export type CyclePhase =
  | 'Period'
  | 'Follicular'
  | 'Ovulation'
  | 'Luteal';

export type PeriodSettings = {
  tracking_enabled: boolean;

  partner_visibility:
    | PeriodVisibility;

  average_cycle_length: number;

  average_period_length: number;

  share_symptoms?: boolean;

  share_mood?: boolean;

  share_flow?: boolean;
};

export type PeriodLog = {
  id: string;

  start_date: string;

  end_date:
    | string
    | null;

  notes?:
    | string
    | null;

  created_at?:
    | string
    | null;

  updated_at?:
    | string
    | null;
};

export type PeriodSymptom = {
  id: string;

  symptom_date: string;

  symptom_type: string;

  severity: SymptomSeverity;

  mood?:
    | string
    | null;

  energy_level?:
    | number
    | null;

  created_at?:
    | string
    | null;

  updated_at?:
    | string
    | null;
};

export type PartnerPeriodSummary = {
  partner_visibility:
    | PeriodVisibility;

  latest_period_start:
    | string
    | null;

  predicted_next_period:
    | string
    | null;

  average_cycle_length: number;

  average_period_length?: number;
};

export type PeriodDashboard = {
  success: boolean;

  own: {
    settings: PeriodSettings;

    periods: PeriodLog[];

    symptoms: PeriodSymptom[];
  };

  partner: {
    visibility:
      | PeriodVisibility;

    settings?: PartnerPeriodSummary;

    periods?: PeriodLog[];

    symptoms?: PeriodSymptom[];
  } | null;
};

export type CurrentCycleInfo = {
  cycleDay: number | null;

  phase: CyclePhase;

  latestPeriod:
    | PeriodLog
    | null;

  nextPeriod:
    | string
    | null;

  ovulationDate:
    | string
    | null;

  fertileWindow: {
    start:
      | string
      | null;

    end:
      | string
      | null;
  };
};

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_SETTINGS: PeriodSettings = {
  tracking_enabled: true,

  partner_visibility:
    'private',

  average_cycle_length: 28,

  average_period_length: 5,

  share_symptoms: true,

  share_mood: true,

  share_flow: true,
};

// ============================================================
// DATE HELPERS
// ============================================================

export function formatDate(
  date: Date
): string {
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

export function parseDate(
  dateString: string
): Date {
  return new Date(
    `${dateString}T12:00:00`
  );
}

export function getTodayString(): string {
  return formatDate(
    new Date()
  );
}

export function addDays(
  dateString: string,
  days: number
): string {
  const date =
    parseDate(dateString);

  date.setDate(
    date.getDate() + days
  );

  return formatDate(date);
}

export function daysBetween(
  startDate: string,
  endDate: string
): number {
  const start =
    parseDate(startDate);

  const end =
    parseDate(endDate);

  const difference =
    end.getTime() -
    start.getTime();

  return Math.floor(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

export function isDateInRange(
  date: string,
  start: string,
  end: string
): boolean {
  return (
    date >= start &&
    date <= end
  );
}

// ============================================================
// PERIOD HELPERS
// ============================================================

export function isDateInPeriod(
  date: string,
  period: PeriodLog
): boolean {
  const start =
    period.start_date;

  const end =
    period.end_date ||
    period.start_date;

  return (
    date >= start &&
    date <= end
  );
}

export function sortPeriods(
  periods: PeriodLog[]
): PeriodLog[] {
  return [...periods].sort(
    (a, b) =>
      b.start_date.localeCompare(
        a.start_date
      )
  );
}

export function getLatestPeriod(
  periods: PeriodLog[]
): PeriodLog | null {
  if (!periods.length) {
    return null;
  }

  return (
    sortPeriods(periods)[0] ||
    null
  );
}

export function getCycleDay(
  latestStart:
    | string
    | null,
  today:
    | string
    | null = getTodayString()
): number | null {
  if (!latestStart || !today) {
    return null;
  }

  const difference =
    daysBetween(
      latestStart,
      today
    );

  return difference + 1;
}

// ============================================================
// CYCLE PHASE
// ============================================================

export function getCyclePhase(
  cycleDay:
    | number
    | null,
  averageCycleLength:
    number,
  averagePeriodLength:
    number
): CyclePhase {
  if (
    !cycleDay ||
    cycleDay <= 0
  ) {
    return 'Follicular';
  }

  if (
    cycleDay <=
    averagePeriodLength
  ) {
    return 'Period';
  }

  const ovulationDay =
    Math.max(
      1,
      averageCycleLength - 14
    );

  if (
    Math.abs(
      cycleDay -
        ovulationDay
    ) <= 1
  ) {
    return 'Ovulation';
  }

  if (
    cycleDay <
    ovulationDay
  ) {
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
  latestStart:
    | string
    | null,
  cycleLength:
    number
): string | null {
  if (!latestStart) {
    return null;
  }

  const ovulationOffset =
    Math.max(
      1,
      cycleLength - 14
    );

  return addDays(
    latestStart,
    ovulationOffset - 1
  );
}

export function getFertileWindow(
  latestStart:
    | string
    | null,
  cycleLength:
    number
) {
  if (!latestStart) {
    return {
      start: null,
      end: null,
    };
  }

  const ovulation =
    getEstimatedOvulationDate(
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
    start: addDays(
      ovulation,
      -5
    ),

    end: addDays(
      ovulation,
      1
    ),
  };
}

// ============================================================
// NEXT PERIOD
// ============================================================

export function getPredictedNextPeriod(
  periods: PeriodLog[],
  cycleLength: number
): string | null {
  const latest =
    getLatestPeriod(
      periods
    );

  if (!latest) {
    return null;
  }

  return addDays(
    latest.start_date,
    cycleLength
  );
}

// ============================================================
// CURRENT CYCLE
// ============================================================

export function getCurrentCycleInfo(
  periods: PeriodLog[],
  settings:
    | PeriodSettings
    | null
    | undefined
): CurrentCycleInfo {
  const safeSettings =
    settings ||
    DEFAULT_SETTINGS;

  const latestPeriod =
    getLatestPeriod(
      periods
    );

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

  const today =
    getTodayString();

  let cycleDay =
    getCycleDay(
      latestPeriod.start_date,
      today
    );

  /*
   * If the current date is before the latest logged period,
   * don't return a negative/invalid cycle day.
   */
  if (
    cycleDay !== null &&
    cycleDay < 1
  ) {
    cycleDay = null;
  }

  const phase =
    getCyclePhase(
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
// DASHBOARD NORMALIZATION
// ============================================================

function normalizeSettings(
  value:
    | Partial<PeriodSettings>
    | null
    | undefined
): PeriodSettings {
  return {
    tracking_enabled:
      typeof value?.tracking_enabled ===
      'boolean'
        ? value.tracking_enabled
        : DEFAULT_SETTINGS.tracking_enabled,

    partner_visibility:
      value?.partner_visibility ===
        'summary' ||
      value?.partner_visibility ===
        'full'
        ? value.partner_visibility
        : 'private',

    average_cycle_length:
      Number(
        value?.average_cycle_length
      ) ||
      DEFAULT_SETTINGS.average_cycle_length,

    average_period_length:
      Number(
        value?.average_period_length
      ) ||
      DEFAULT_SETTINGS.average_period_length,

    share_symptoms:
      typeof value?.share_symptoms ===
      'boolean'
        ? value.share_symptoms
        : DEFAULT_SETTINGS.share_symptoms,

    share_mood:
      typeof value?.share_mood ===
      'boolean'
        ? value.share_mood
        : DEFAULT_SETTINGS.share_mood,

    share_flow:
      typeof value?.share_flow ===
      'boolean'
        ? value.share_flow
        : DEFAULT_SETTINGS.share_flow,
  };
}

function normalizePeriod(
  value: any
): PeriodLog {
  return {
    id:
      String(
        value?.id || ''
      ),

    start_date:
      String(
        value?.start_date || ''
      ),

    end_date:
      value?.end_date ??
      null,

    notes:
      value?.notes ??
      null,

    created_at:
      value?.created_at ??
      null,

    updated_at:
      value?.updated_at ??
      null,
  };
}

function normalizeSymptom(
  value: any
): PeriodSymptom {
  const severity =
    value?.severity ===
      'moderate' ||
    value?.severity ===
      'strong'
      ? value.severity
      : 'mild';

  return {
    id:
      String(
        value?.id || ''
      ),

    symptom_date:
      String(
        value?.symptom_date || ''
      ),

    symptom_type:
      String(
        value?.symptom_type || ''
      ),

    severity,

    mood:
      value?.mood ??
      null,

    energy_level:
      value?.energy_level ??
      null,

    created_at:
      value?.created_at ??
      null,

    updated_at:
      value?.updated_at ??
      null,
  };
}

// ============================================================
// GET PERIOD DASHBOARD
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

  const raw =
    (data || {}) as any;

  const ownRaw =
    raw?.own || {};

  const partnerRaw =
    raw?.partner || null;

  const ownPeriods: PeriodLog[] =
    Array.isArray(
      ownRaw?.periods
    )
      ? ownRaw.periods.map(
          normalizePeriod
        )
      : [];

  const ownSymptoms: PeriodSymptom[] =
    Array.isArray(
      ownRaw?.symptoms
    )
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
      visibility:
        partnerRaw?.visibility ===
          'summary' ||
        partnerRaw?.visibility ===
          'full'
          ? partnerRaw.visibility
          : 'private',

      settings:
        partnerRaw?.settings
          ? {
              partner_visibility:
                partnerRaw.settings
                  ?.partner_visibility ===
                  'summary' ||
                partnerRaw.settings
                  ?.partner_visibility ===
                  'full'
                  ? partnerRaw.settings
                      .partner_visibility
                  : 'private',

              latest_period_start:
                partnerRaw.settings
                  ?.latest_period_start ??
                null,

              predicted_next_period:
                partnerRaw.settings
                  ?.predicted_next_period ??
                null,

              average_cycle_length:
                Number(
                  partnerRaw.settings
                    ?.average_cycle_length
                ) || 28,

              average_period_length:
                Number(
                  partnerRaw.settings
                    ?.average_period_length
                ) || 5,
            }
          : undefined,

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

      p_partner_visibility:
        settings.partner_visibility,

      p_average_cycle_length:
        settings.average_cycle_length,

      p_average_period_length:
        settings.average_period_length,

      /*
       * These are included for the newer migration.
       * If the RPC does not accept them yet, Supabase
       * will return the exact RPC error instead of silently
       * changing anything.
       */
      p_share_symptoms:
        settings.share_symptoms ??
        true,

      p_share_mood:
        settings.share_mood ??
        true,

      p_share_flow:
        settings.share_flow ??
        true,
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
  endDate:
    | string
    | null,
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
  endDate:
    | string
    | null,
  notes: string = ''
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'update_period_log',
    {
      p_id: id,

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
      p_id: id,
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

  severity:
    | SymptomSeverity;

  mood?:
    | string
    | null;

  energyLevel?:
    | number
    | null;
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
        input.mood ??
        null,

      p_energy_level:
        input.energyLevel ??
        null,
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
      p_id: id,
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
      symptom.symptom_date ===
      date
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

  const intervals: number[] =
    [];

  for (
    let i = 0;
    i <
    sorted.length - 1;
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
    ) /
    intervals.length;

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

  const difference =
    daysBetween(
      period.start_date,
      period.end_date
    );

  return (
    difference + 1
  );
}

// ============================================================
// SAFE CYCLE DAY
// ============================================================

export function getSafeCycleDay(
  latestStart:
    | string
    | null,
  today:
    | string
    | null = getTodayString()
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
  latestStart:
    | string
    | null,
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
  latestStart:
    | string
    | null,
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

  getCycleDay,

  getCyclePhase,

  getPredictedNextPeriod,

  getEstimatedOvulationDate,

  getFertileWindow,

  getLatestPeriod,

  getSymptomsForDate,

  getTodaySymptoms,
};