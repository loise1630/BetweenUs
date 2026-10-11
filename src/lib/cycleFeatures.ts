import { getAccountState } from './account';
import { supabase } from './supabase';

export type CycleDailyLog = {
  id: string;
  user_id: string;
  log_date: string;
  mood: string | null;
  energy_level: number | null;
  flow_intensity: 'light' | 'medium' | 'heavy' | null;
  cravings: string[];
  sleep_hours: number | null;
  water_glasses: number;
  exercise_minutes: number;
};

export type DailyStatus = {
  user_id: string;
  log_date: string;
  status: string;
  updated_at: string;
};

export type SharedDailyWellness = {
  user_id: string;
  log_date: string;
  mood: string | null;
  energy_level: number | null;
  flow_intensity: 'light' | 'medium' | 'heavy' | null;
  cravings: string[];
  updated_at: string;
};

async function getWellnessSubjectId() {
  const account = await getAccountState();
  return account.role === 'boyfriend'
    ? account.members?.find((member) => member.role === 'girlfriend')?.user_id
    : account.user_id;
}

export async function getSharedDailyWellness(): Promise<SharedDailyWellness[]> {
  const subjectId = await getWellnessSubjectId();
  if (!subjectId) return [];
  const { data, error } = await supabase.from('relationship_daily_wellness').select('*').eq('user_id', subjectId).order('log_date', { ascending: false }).limit(180);
  if (error) throw error;
  return (data ?? []) as SharedDailyWellness[];
}

export async function saveSharedDailyWellness(input: Pick<SharedDailyWellness, 'log_date' | 'mood' | 'energy_level' | 'flow_intensity' | 'cravings'>): Promise<void> {
  const account = await getAccountState();
  if (!account.user_id || account.role !== 'girlfriend') throw new Error('Only the girlfriend can update shared wellness.');
  const { error } = await supabase.from('relationship_daily_wellness').upsert({
    ...input,
    user_id: account.user_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function saveSharedCravings(cravings: string[], logDate: string): Promise<void> {
  const account = await getAccountState();
  if (!account.user_id || account.role !== 'girlfriend') throw new Error('Only the girlfriend can update shared cravings.');
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase.from('relationship_daily_wellness')
    .update({ cravings, updated_at: updatedAt })
    .eq('user_id', account.user_id)
    .eq('log_date', logDate)
    .select('user_id')
    .maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await supabase.from('relationship_daily_wellness').insert({
    user_id: account.user_id,
    log_date: logDate,
    cravings,
    updated_at: updatedAt,
  });
  if (insertError) throw insertError;
}

export async function getCycleDailyLogs(userId?: string): Promise<CycleDailyLog[]> {
  let query = supabase.from('cycle_daily_logs').select('*').order('log_date', { ascending: false }).limit(180);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CycleDailyLog[];
}

export async function saveCycleDailyLog(input: Omit<CycleDailyLog, 'id' | 'user_id'>): Promise<void> {
  const account = await getAccountState();
  if (!account.user_id) throw new Error('Please sign in again.');
  const { error } = await supabase.from('cycle_daily_logs').upsert({
    ...input,
    user_id: account.user_id,
  }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function getDailyStatus(): Promise<DailyStatus | null> {
  const account = await getAccountState();
  const subjectId = account.role === 'boyfriend' ? account.members?.find((member) => member.role === 'girlfriend')?.user_id : account.user_id;
  if (!subjectId) return null;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase.from('relationship_daily_status').select('*').eq('user_id', subjectId).eq('log_date', todayString).maybeSingle();
  if (error) throw error;
  return data as DailyStatus | null;
}

export async function saveDailyStatus(status: string, logDate: string): Promise<void> {
  const account = await getAccountState();
  if (!account.user_id) throw new Error('Please sign in again.');
  const { error } = await supabase.from('relationship_daily_status').upsert({
    user_id: account.user_id,
    log_date: logDate,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function subscribeCycleFeatures(onChange: () => void): Promise<() => void> {
  const account = await getAccountState();
  if (!account.user_id) return () => undefined;
  const channel = supabase.channel(`cycle-features:${account.user_id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cycle_daily_logs', filter: `user_id=eq.${account.user_id}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'relationship_daily_wellness' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'relationship_daily_status' }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
