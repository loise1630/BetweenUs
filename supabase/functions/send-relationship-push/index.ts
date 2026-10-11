import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('RELATIONSHIP_PUSH_WEBHOOK_SECRET')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!webhookSecret || request.headers.get('x-relationship-push-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const notificationId = payload?.record?.id;
  if (!notificationId) return json({ error: 'Notification record is required' }, 400);

  const { data: notification, error: notificationError } = await supabase
    .from('relationship_notifications')
    .select('id,recipient_id,actor_id,kind,source_id,source_table')
    .eq('id', notificationId)
    .maybeSingle();
  if (notificationError) return json({ error: notificationError.message }, 500);
  if (!notification || !notification.actor_id || notification.actor_id === notification.recipient_id) {
    return json({ skipped: true, reason: 'No partner actor' });
  }

  // A webhook is only a wake-up signal. Re-check that actor and recipient are
  // currently members of the same couple before sending anything.
  const { data: actorMemberships, error: actorError } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', notification.actor_id);
  const { data: recipientMemberships, error: recipientError } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', notification.recipient_id);
  if (actorError || recipientError) return json({ error: 'Could not validate couple membership' }, 500);
  const sharesCouple = (actorMemberships ?? []).some((actor) =>
    (recipientMemberships ?? []).some((recipient) => recipient.couple_id === actor.couple_id)
  );
  if (!sharesCouple) {
    return json({ skipped: true, reason: 'Actor and recipient are not paired' });
  }

  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('push_enabled,message_alerts,reply_alerts,shared_update_alerts,preview_on_lock_screen')
    .eq('user_id', notification.recipient_id)
    .maybeSingle();
  if (!preferences?.push_enabled) return json({ skipped: true, reason: 'Push disabled' });
  if ((notification.kind === 'message' && !preferences.message_alerts)
      || (notification.kind === 'reply' && !preferences.reply_alerts)
      || (notification.kind !== 'message' && notification.kind !== 'reply' && !preferences.shared_update_alerts)) {
    return json({ skipped: true, reason: 'Notification type disabled' });
  }

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id,expo_push_token')
    .eq('user_id', notification.recipient_id);
  if (tokenError) return json({ error: tokenError.message }, 500);
  if (!tokens?.length) return json({ skipped: true, reason: 'No registered devices' });

  const title = 'Between Us';
  const body = preferences.preview_on_lock_screen
    ? notification.kind === 'reply'
      ? 'Your partner replied to you.'
      : notification.kind === 'shared_checkin'
        ? 'Your partner shared a check-in.'
        : notification.kind === 'shared_want'
          ? 'Your partner added a want.'
            : notification.kind === 'shared_cycle'
              ? 'Your partner updated period dates.'
              : notification.kind === 'shared_symptom'
                ? 'Your partner logged a symptom.'
                : notification.kind === 'shared_entry'
                  ? 'Your partner added something to Between Us.'
                  : 'You have a new message.'
    : 'You have a new update.';

  const route = notification.kind === 'shared_checkin'
    ? '/check-in'
    : notification.kind === 'shared_want'
      ? '/want'
      : notification.kind === 'shared_entry'
        ? '/between-us'
        : notification.kind === 'shared_cycle' || notification.kind === 'shared_symptom'
          ? '/period'
          : '/messages';

  let sent = 0;
  let skipped = 0;
  for (const device of tokens) {
    const tokenHash = await sha256(device.expo_push_token);
    const { data: claim } = await supabase
      .from('push_delivery_log')
      .upsert({
        notification_id: notification.id,
        token_hash: tokenHash,
        status: 'sending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'notification_id,token_hash', ignoreDuplicates: true })
      .select('id');
    if (!claim?.length) {
      skipped += 1;
      continue;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: device.expo_push_token,
          title,
          body,
          sound: 'default',
          data: { route, notificationId: notification.id },
        }),
      });
      const result = await response.json();
      const ticket = result?.data;
      if (!response.ok || ticket?.status === 'error') {
        const message = ticket?.message || `Expo push returned ${response.status}`;
        await supabase.from('push_delivery_log').update({ status: 'error', last_error: message, updated_at: new Date().toISOString() }).eq('notification_id', notification.id).eq('token_hash', tokenHash);
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          await supabase.from('push_tokens').delete().eq('id', device.id);
        }
      } else {
        await supabase.from('push_delivery_log').update({ status: 'sent', expo_ticket_id: ticket?.id ?? null, last_error: null, updated_at: new Date().toISOString() }).eq('notification_id', notification.id).eq('token_hash', tokenHash);
        sent += 1;
      }
    } catch (error) {
      await supabase.from('push_delivery_log').update({ status: 'error', last_error: String(error), updated_at: new Date().toISOString() }).eq('notification_id', notification.id).eq('token_hash', tokenHash);
    }
  }

  return json({ sent, skipped });
});
