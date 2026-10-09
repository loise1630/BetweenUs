
import { getAccountState } from './account';
import { supabase } from './supabase';

export type PartnerMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  parent_id: string | null;
  reply_to_id?: string | null;
  read_at: string | null;
  created_at: string;
};

function normalizeMessage(
  row: Record<string, any>
): PartnerMessage {
  return {
    id: String(row.id),
    sender_id: String(row.sender_id),
    recipient_id: String(row.recipient_id),
    body: String(row.body ?? ''),
    parent_id: row.parent_id ?? row.reply_to_id ?? null,
    reply_to_id: row.parent_id ?? row.reply_to_id ?? null,
    read_at: row.read_at ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

async function getAccountAndPartner() {
  const account = await getAccountState();

  if (!account.user_id) {
    throw new Error('Your account could not be identified. Please log in again.');
  }

  if (account.status !== 'paired' || !account.couple_id) {
    throw new Error('Pair with your partner before using messages.');
  }

  const members = Array.isArray(account.members)
    ? account.members
    : [];

  const partner = members.find(
    (member) => member.user_id !== account.user_id
  );

  if (!partner?.user_id) {
    throw new Error(
      'Your partner could not be found. Please check your pairing status.'
    );
  }

  return {
    userId: account.user_id,
    partnerId: partner.user_id,
  };
}

/**
 * Load recent messages sent between the current user and their partner.
 */
export async function getPartnerMessages(): Promise<PartnerMessage[]> {
  const { userId, partnerId } = await getAccountAndPartner();

  const { data, error } = await supabase
    .from('partner_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    normalizeMessage(row as Record<string, any>)
  );
}

/**
 * Send a message or reply to the paired partner.
 */
export async function sendPartnerMessage(
  body: string,
  replyToId: string | null = null
): Promise<PartnerMessage> {
  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new Error('Please enter a message.');
  }

  if (cleanBody.length > 500) {
    throw new Error('Messages must be 500 characters or fewer.');
  }

  const { userId, partnerId } = await getAccountAndPartner();

  if (replyToId) {
    const { data: parent, error: parentError } = await supabase
      .from('partner_messages')
      .select('id, sender_id, recipient_id')
      .eq('id', replyToId)
      .maybeSingle();

    if (parentError) {
      throw parentError;
    }

    if (
      !parent ||
      !(
        (parent.sender_id === userId &&
          parent.recipient_id === partnerId) ||
        (parent.sender_id === partnerId &&
          parent.recipient_id === userId)
      )
    ) {
      throw new Error('The message you are replying to could not be found.');
    }
  }

  const { data, error } = await supabase
    .from('partner_messages')
    .insert({
      sender_id: userId,
      recipient_id: partnerId,
      body: cleanBody,
      parent_id: replyToId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeMessage(data as Record<string, any>);
}

/**
 * Mark messages addressed to the current user as read.
 */
export async function markPartnerMessagesRead(
  ids: string[]
): Promise<void> {
  if (!ids.length) return;

  const { userId } = await getAccountAndPartner();

  const { error } = await supabase
    .from('partner_messages')
    .update({
      read_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}
