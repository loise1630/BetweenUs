import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getPeriodDashboard,
  PeriodDashboard,
  PeriodLog,
  PeriodSettings,
  PeriodSymptom,
} from '../lib/period';
import { getAccountState } from '../lib/account';

type CycleDashboardState = {
  loading: boolean;
  error: string | null;
  viewerMode: boolean;
  periods: PeriodLog[];
  symptoms: PeriodSymptom[];
  settings: PeriodSettings;
  reload: () => void;
};

const DEFAULT_SETTINGS: PeriodSettings = {
  tracking_enabled: true,
  average_cycle_length: 28,
  average_period_length: 5,
};

function accountRole(account: any): 'boyfriend' | 'girlfriend' | 'unknown' {
  const role = String(
    account?.role ?? account?.user_role ?? account?.relationship_role ?? account?.account_role ?? ''
  ).trim().toLowerCase();
  if (['boyfriend', 'boy', 'male'].includes(role)) return 'boyfriend';
  if (['girlfriend', 'girl', 'female'].includes(role)) return 'girlfriend';
  return 'unknown';
}

export function useCycleDashboard(): CycleDashboardState {
  const [dashboard, setDashboard] = useState<PeriodDashboard | null>(null);
  const [viewerMode, setViewerMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const account = await getAccountState();
        const cacheKey = account.user_id ? `@betweenus_dashboard_v1_${account.user_id}` : null;
        let data: PeriodDashboard;
        try {
          data = await getPeriodDashboard();
          if (cacheKey) await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (cause) {
          const cached = cacheKey ? await AsyncStorage.getItem(cacheKey) : null;
          if (!cached) throw cause;
          data = JSON.parse(cached) as PeriodDashboard;
        }
        if (!active) return;

        const role = accountRole(account);
        const inferredBoyfriend = !!(
          data.partner &&
          ((data.partner.periods?.length ?? 0) > 0 ||
            data.partner.settings?.latest_period_start) &&
          (data.own.periods?.length ?? 0) === 0
        );
        const isBoyfriend = role === 'boyfriend' || (role === 'unknown' && inferredBoyfriend);
        setViewerMode(isBoyfriend);
        setDashboard(data);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Could not load cycle data.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const partner = dashboard?.partner;
  const periods = viewerMode
    ? (partner?.periods ?? []).length > 0
      ? partner!.periods
      : partner?.settings?.latest_period_start
        ? [{
            id: 'shared-summary',
            start_date: partner.settings.latest_period_start,
            end_date: null,
          }]
        : []
    : dashboard?.own.periods ?? [];
  const symptoms = viewerMode ? partner?.symptoms ?? [] : dashboard?.own.symptoms ?? [];
  const settings: PeriodSettings = viewerMode
    ? {
        ...DEFAULT_SETTINGS,
        average_cycle_length: partner?.settings?.average_cycle_length || 28,
        average_period_length: partner?.settings?.average_period_length || 5,
      }
    : dashboard?.own.settings ?? DEFAULT_SETTINGS;

  return {
    loading,
    error,
    viewerMode,
    periods,
    symptoms,
    settings,
    reload: () => {
      setLoading(true);
      setError(null);
      setReloadKey((value) => value + 1);
    },
  };
}
