import { getAccountState, type AccountRole } from './account';
import { supabase } from './supabase';

export type PartnerWant = {
  id: string;
  role: AccountRole;
  title: string;
  category: 'affection' | 'date' | 'gift' | 'food' | 'care';
  note: string;
  created_at: string;
  fulfilled: boolean;
};

export type PartnerCheckIn = {
  id: string;
  role: AccountRole;
  feeling: string;
  emoji: string;
  intensity: number;
  note: string;
  share_with_partner: boolean;
  updated_at: string;
};

export type RelationshipEntryType = 'unsaid' | 'little_things' | 'love_hate' | 'bucket_list';

export type RelationshipEntry = {
  id: string;
  user_id: string;
  role: AccountRole;
  entry_type: RelationshipEntryType;
  title: string;
  body: string;
  created_at: string;
};

export type NotificationPreferences = {
  push_enabled: boolean;
  message_alerts: boolean;
  reply_alerts: boolean;
  shared_update_alerts: boolean;
  preview_on_lock_screen: boolean;
};

export type RelationshipNotification = {
  id: string;
  actor_id: string | null;
  kind:
    | 'message'
    | 'reply'
    | 'shared_checkin'
    | 'shared_want'
    | 'shared_cycle'
    | 'shared_symptom'
    | 'shared_entry';
  source_id: string;
  created_at: string;
  read_at: string | null;
};

export async function getRelationshipEntries(
  entryType: RelationshipEntryType
): Promise<RelationshipEntry[]> {
  const { account } = await getPairedAccount();
  const { data, error } = await supabase
    .from('relationship_entries')
    .select('id,user_id,entry_type,title,body,created_at')
    .eq('entry_type', entryType)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const roleByUser = new Map((account.members ?? []).map((member) => [member.user_id, member.role]));
  return (data ?? []).map((row) => ({
    ...row,
    role: roleByUser.get(row.user_id) ?? account.role ?? 'girlfriend',
  } as RelationshipEntry));
}

export async function addRelationshipEntry(
  entryType: RelationshipEntryType,
  title: string,
  body: string
): Promise<RelationshipEntry> {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || !cleanBody) throw new Error('Add a title and your own words before saving.');
  if (cleanTitle.length > 120 || cleanBody.length > 2000) {
    throw new Error('Keep the title under 120 characters and the entry under 2,000 characters.');
  }

  const { account, userId } = await getPairedAccount();
  if (!account.role) throw new Error('Your account role could not be identified.');
  const { data, error } = await supabase
    .from('relationship_entries')
    .insert({ user_id: userId, entry_type: entryType, title: cleanTitle, body: cleanBody })
    .select('id,user_id,entry_type,title,body,created_at')
    .single();
  if (error) throw error;
  return { ...data, role: account.role } as RelationshipEntry;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: false,
  message_alerts: true,
  reply_alerts: true,
  shared_update_alerts: true,
  preview_on_lock_screen: false,
};

async function getPairedAccount() {
  const account = await getAccountState();
  if (!account.user_id) throw new Error('Your account could not be identified.');
  if (account.status !== 'paired' || !account.couple_id) {
    throw new Error('Pair with your partner to use this feature.');
  }

  const partner = account.members?.find((member) => member.user_id !== account.user_id);
  if (!partner) throw new Error('Your paired partner could not be found.');

  return { account, partner, userId: account.user_id };
}

export async function getPartnerWants(): Promise<PartnerWant[]> {
  const { partner } = await getPairedAccount();
  const { data, error } = await supabase
    .from('relationship_wants')
    .select('id,user_id,title,category,note,created_at,fulfilled')
    .eq('user_id', partner.user_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, role: partner.role } as PartnerWant));
}

export async function getMyWants(): Promise<PartnerWant[]> {
  const { account, userId } = await getPairedAccount();
  const { data, error } = await supabase
    .from('relationship_wants')
    .select('id,title,category,note,created_at,fulfilled')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, role: account.role, note: row.note ?? '' } as PartnerWant));
}

export async function addPartnerWant(
  role: AccountRole,
  title: string,
  category: PartnerWant['category'] = 'affection',
  note = ''
): Promise<PartnerWant> {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Add a title for your want.');
  if (cleanTitle.length > 120 || note.trim().length > 500) {
    throw new Error('Keep the title under 120 characters and the note under 500.');
  }

  const { account, userId } = await getPairedAccount();
  if (account.role !== role) throw new Error('You can only add a want to your own account.');

  const { data, error } = await supabase
    .from('relationship_wants')
    .insert({ user_id: userId, title: cleanTitle, category, note: note.trim() })
    .select('id,title,category,note,created_at,fulfilled')
    .single();
  if (error) throw error;
  return { ...data, role, note: data.note ?? '', fulfilled: false } as PartnerWant;
}

export async function toggleWantFulfilled(id: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_partner_want_fulfilled', { p_want_id: id });
  if (error) throw error;
}

export async function getPartnerCheckIn(
  role: AccountRole
): Promise<PartnerCheckIn | null> {
  const { partner } = await getPairedAccount();
  if (partner.role !== role) return null;

  const { data, error } = await supabase
    .from('relationship_checkins')
    .select('id,feeling,emoji,intensity,note,share_with_partner,updated_at')
    .eq('user_id', partner.user_id)
    .eq('share_with_partner', true)
    .maybeSingle();
  if (error) throw error;
  return data ? ({ ...data, role: partner.role, note: data.note ?? '' } as PartnerCheckIn) : null;
}

export async function getMyCheckIn(): Promise<PartnerCheckIn | null> {
  const { account, userId } = await getPairedAccount();
  const { data, error } = await supabase
    .from('relationship_checkins')
    .select('id,feeling,emoji,intensity,note,share_with_partner,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data && account.role
    ? ({ ...data, role: account.role, note: data.note ?? '' } as PartnerCheckIn)
    : null;
}

export async function savePartnerCheckIn(
  role: AccountRole,
  feeling: string,
  emoji: string,
  note = '',
  intensity = 5,
  shareWithPartner = false
): Promise<PartnerCheckIn> {
  const cleanFeeling = feeling.trim();
  if (!cleanFeeling) throw new Error('Choose how you are feeling.');
  if (cleanFeeling.length > 60 || note.trim().length > 500) {
    throw new Error('Keep your feeling under 60 characters and note under 500.');
  }

  const { account, userId } = await getPairedAccount();
  if (account.role !== role) throw new Error('You can only edit your own check-in.');

  const { data, error } = await supabase
    .from('relationship_checkins')
    .upsert({
      user_id: userId,
      feeling: cleanFeeling,
      emoji: emoji.trim() || '💛',
      note: note.trim(),
      intensity: Math.max(1, Math.min(5, Math.round(intensity))),
      share_with_partner: shareWithPartner,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('id,feeling,emoji,intensity,note,share_with_partner,updated_at')
    .single();
  if (error) throw error;
  return { ...data, role, note: data.note ?? '' } as PartnerCheckIn;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { userId } = await getPairedAccount();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('push_enabled,message_alerts,reply_alerts,shared_update_alerts,preview_on_lock_screen')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_PREFERENCES, ...(data ?? {}) };
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const { userId } = await getPairedAccount();
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('push_enabled,message_alerts,reply_alerts,shared_update_alerts,preview_on_lock_screen')
    .single();
  if (error) throw error;
  return data;
}

export async function getRelationshipNotifications(): Promise<RelationshipNotification[]> {
  const { userId } = await getPairedAccount();
  const { data, error } = await supabase
    .from('relationship_notifications')
    .select('id,actor_id,kind,source_id,created_at,read_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as RelationshipNotification[];
}

export async function markRelationshipNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.rpc('mark_relationship_notifications_read', { p_notification_ids: ids });
  if (error) throw error;
}

export async function subscribeRelationshipNotifications(onChange: () => void): Promise<() => void> {
  const { userId } = await getPairedAccount();
  const channel = supabase
    .channel(`relationship-notifications:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'relationship_notifications',
      filter: `recipient_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function savePushToken(token: string): Promise<void> {
  const { userId } = await getPairedAccount();
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() }, { onConflict: 'expo_push_token' });
  if (error) throw error;
}

export async function removePushToken(token: string): Promise<void> {
  const { userId } = await getPairedAccount();
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('expo_push_token', token);
  if (error) throw error;
}
