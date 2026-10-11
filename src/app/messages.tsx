import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAccountState, type AccountState } from '../lib/account';
import {
  getPartnerMessages,
  markPartnerMessagesRead,
  PartnerMessage,
  sendPartnerMessage,
  subscribePartnerMessages,
} from '../lib/partnerMessages';

export default function MessagesScreen() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PartnerMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestInFlight = useRef(false);
  const listRef = useRef<FlatList<PartnerMessage>>(null);

  const load = useCallback(async (showLoader = false, showAlert = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoader) setLoading(true);
    try {
      const [nextAccount, items] = await Promise.all([getAccountState(), getPartnerMessages()]);
      setAccount(nextAccount);
      setMessages([...items].reverse());
      const unreadIncoming = items
        .filter((item) => item.recipient_id === nextAccount.user_id && !item.read_at)
        .map((item) => item.id);
      if (unreadIncoming.length) await markPartnerMessagesRead(unreadIncoming);
    } catch (error: any) {
      if (showAlert) Alert.alert('Could not load messages', error?.message || 'Check your connection and try again.');
      else console.warn('Could not refresh messages:', error);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(true, true);
    let stop: (() => void) | undefined;
    void subscribePartnerMessages(() => { if (active) void load(); })
      .then((unsubscribe) => { if (active) stop = unsubscribe; else unsubscribe(); })
      .catch((error) => console.warn('Message realtime subscription unavailable:', error));
    return () => {
      active = false;
      stop?.();
    };
  }, [load]));

  const partner = account?.members?.find((member) => member.user_id !== account.user_id);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > 500) {
      Alert.alert('Message too long', 'Messages can be up to 500 characters.');
      return;
    }
    try {
      setSending(true);
      const message = await sendPartnerMessage(body, replyTo?.id ?? null);
      setMessages((current) => [...current, message]);
      setDraft('');
      setReplyTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error: any) {
      Alert.alert('Could not send message', error?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: PartnerMessage }) {
    const mine = item.sender_id === account?.user_id;
    const quoted = item.parent_id ? messages.find((message) => message.id === item.parent_id) : null;
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePartner]}>
          {quoted ? <Text style={[styles.quoted, mine && styles.quotedMine]} numberOfLines={2}>{quoted.body}</Text> : null}
          <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, mine && styles.metaMine]}>{new Date(item.created_at).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}</Text>
            {mine && item.read_at ? <Text style={[styles.meta, styles.read]}>Read</Text> : null}
          </View>
        </View>
        <Pressable onPress={() => setReplyTo(item)} style={styles.replyButton} accessibilityRole="button" accessibilityLabel="Reply to message">
          <Feather name="corner-up-left" size={15} color={COLORS.muted} />
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={20} color={COLORS.text} /></Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{account?.role === 'boyfriend' ? 'Her Messages' : 'Messages'}</Text>
            <Text style={styles.subtitle}>{partner?.name ? `With ${partner.name}` : 'Between you two'}</Text>
          </View>
          <Pressable onPress={() => void load(true, true)} style={styles.refresh} accessibilityRole="button" accessibilityLabel="Refresh messages"><Feather name="refresh-cw" size={18} color={COLORS.text} /></Pressable>
        </View>

        {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.pink} /></View> : messages.length === 0 ? (
          <View style={styles.empty}><Feather name="message-circle" size={30} color={COLORS.pink} /><Text style={styles.emptyTitle}>Start a conversation</Text><Text style={styles.emptyText}>Send a thoughtful note to your partner.</Text></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            onRefresh={() => { setRefreshing(true); void load(false, true); }}
            refreshing={refreshing}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {replyTo ? <View style={styles.replyBanner}><View style={styles.replyCopy}><Text style={styles.replyLabel}>Replying to</Text><Text numberOfLines={1} style={styles.replyQuote}>{replyTo.body}</Text></View><Pressable onPress={() => setReplyTo(null)}><Feather name="x" size={19} color={COLORS.muted} /></Pressable></View> : null}
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} maxLength={500} multiline placeholder="Write a message..." placeholderTextColor={COLORS.muted} style={styles.input} editable={!sending} />
          <Pressable onPress={send} disabled={!draft.trim() || sending} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]} accessibilityRole="button" accessibilityLabel="Send message">
            {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Feather name="arrow-up" size={20} color="#FFFFFF" />}
          </Pressable>
        </View>
        <Text style={styles.counter}>{draft.length}/500</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const COLORS = { bg: '#FDFDFB', text: '#17181C', muted: '#737B88', border: '#DCE2EB', pink: '#E5609F', pinkSoft: '#FCE8F1', white: '#FFFFFF' };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, flex: { flex: 1 }, header: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border }, headerText: { flex: 1, marginLeft: 12 }, title: { fontSize: 18, fontWeight: '600', color: COLORS.text }, subtitle: { marginTop: 3, fontSize: 12, color: COLORS.muted }, refresh: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '600', color: COLORS.text }, emptyText: { marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 20, color: COLORS.muted }, list: { padding: 18, paddingBottom: 25 }, messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 }, messageRowMine: { justifyContent: 'flex-end' }, bubble: { maxWidth: '83%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 18 }, bubbleMine: { backgroundColor: COLORS.pink, borderBottomRightRadius: 5 }, bubblePartner: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 5 }, body: { color: COLORS.text, fontSize: 14, lineHeight: 20 }, bodyMine: { color: '#FFFFFF' }, quoted: { paddingBottom: 7, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border, color: COLORS.muted, fontSize: 12 }, quotedMine: { color: 'rgba(255,255,255,.8)', borderBottomColor: 'rgba(255,255,255,.35)' }, metaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 5 }, meta: { fontSize: 10, color: COLORS.muted }, metaMine: { color: 'rgba(255,255,255,.75)' }, read: { fontWeight: '600' }, replyButton: { width: 32, height: 32, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 14, backgroundColor: COLORS.white, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border }, replyCopy: { flex: 1 }, replyLabel: { fontSize: 10, fontWeight: '600', color: COLORS.pink }, replyQuote: { marginTop: 3, fontSize: 12, color: COLORS.muted }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, borderTopWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white }, input: { flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 22, backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 14 }, sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pink }, sendDisabled: { opacity: 0.45 }, counter: { backgroundColor: COLORS.white, textAlign: 'right', paddingHorizontal: 16, paddingBottom: 8, color: COLORS.muted, fontSize: 10 },
});
