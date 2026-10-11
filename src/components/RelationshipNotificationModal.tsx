import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAccountState } from '../lib/account';
import {
  getPartnerMessages,
  PartnerMessage,
} from '../lib/partnerMessages';
import {
  CurrentCycleInfo,
  getCurrentCycleInfo,
  getCycleInfoForDate,
  getTodayString,
  includeLatestPeriodSummary,
  PeriodDashboard,
  PeriodLog,
  PeriodSettings,
} from '../lib/period';
import {
  getPartnerCheckIn,
  getPartnerWants,
  getRelationshipNotifications,
  markRelationshipNotificationsRead,
  PartnerCheckIn,
  PartnerWant,
  RelationshipNotification,
  subscribeRelationshipNotifications,
  toggleWantFulfilled,
} from '../lib/relationshipData';

type Props = {
  visible: boolean;
  onClose: () => void;
  viewerMode: boolean; // true = Boyfriend viewing, false = Girlfriend viewing
  partnerName?: string;
  dashboard?: PeriodDashboard | null;
  onOpenCompose?: (replyTo?: PartnerMessage | null) => void;
  onUnreadCountChange?: (count: number) => void;
};

function formatTimeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

export default function RelationshipNotificationModal({
  visible,
  onClose,
  viewerMode,
  partnerName = 'Partner',
  dashboard,
  onOpenCompose,
  onUnreadCountChange,
}: Props) {
  const [wants, setWants] = useState<PartnerWant[]>([]);
  const [checkIn, setCheckIn] = useState<PartnerCheckIn | null>(null);
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [notifications, setNotifications] = useState<RelationshipNotification[]>([]);
  const [notificationError, setNotificationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedNotificationCategory, setExpandedNotificationCategory] = useState<string | null>(null);

  // The partner whose updates we are reading:
  // If viewerMode (Boyfriend viewing) -> partner is 'girlfriend'
  // If !viewerMode (Girlfriend viewing) -> partner is 'boyfriend'
  const targetRole = viewerMode ? 'girlfriend' : 'boyfriend';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const account = await getAccountState();
      const [allWants, partnerCheckIn, recentMsgs, recentNotifications] = await Promise.all([
        getPartnerWants(),
        getPartnerCheckIn(targetRole),
        getPartnerMessages().catch(() => []),
        getRelationshipNotifications(),
      ]);

      setWants(allWants.filter((w) => w.role === targetRole));
      setCheckIn(partnerCheckIn);
      setMessages(recentMsgs.filter((message) => message.recipient_id === account.user_id));
      const partnerId = account.members?.find((member) => member.user_id !== account.user_id)?.user_id;
      setNotifications(recentNotifications.filter((item) => !!partnerId && item.actor_id === partnerId));
      setNotificationError('');
    } catch (err) {
      console.error('Error loading relationship notifications:', err);
      setNotificationError('Notifications could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [targetRole]);

  useEffect(() => {
    if (visible) {
      void Promise.resolve().then(loadData);
      let active = true;
      let unsubscribe: (() => void) | undefined;
      void subscribeRelationshipNotifications(() => { if (active) void loadData(); })
        .then((stop) => { if (active) unsubscribe = stop; else stop(); })
        .catch((error) => console.warn('Notification realtime subscription unavailable:', error));
      return () => {
        active = false;
        unsubscribe?.();
      };
    }
    return undefined;
  }, [visible, loadData]);

  const handleToggleWant = async (id: string) => {
    try {
      await toggleWantFulfilled(id);
      const updated = await getPartnerWants();
      setWants(updated.filter((w) => w.role === targetRole));
    } catch (error) {
      console.error('Could not update want:', error);
      Alert.alert('Could not update this want', 'Please try again.');
    }
  };

  // Derive Period Status and Symptoms for Boyfriend's notification:
  const partnerSettings = dashboard?.partner?.settings;
  const periods: PeriodLog[] = includeLatestPeriodSummary(
    dashboard?.partner?.periods || [],
    partnerSettings?.latest_period_start
  );
  const settings: PeriodSettings = {
    tracking_enabled: true,
    average_cycle_length: partnerSettings?.average_cycle_length || 28,
    average_period_length: partnerSettings?.average_period_length || 5,
  };

  const todayStr = getTodayString();
  const todaySymptoms = (dashboard?.partner?.symptoms || []).filter(
    (s) => s.symptom_date === todayStr
  );

  const cycleInfo: CurrentCycleInfo = getCurrentCycleInfo(periods, settings);
  const activeCycle = getCycleInfoForDate(periods, settings, todayStr);

  const phaseName = activeCycle.phase || cycleInfo.phase || 'Follicular';
  const cycleDay = activeCycle.cycleDay || cycleInfo.cycleDay;
  const nextExpected =
    partnerSettings?.predicted_next_period || cycleInfo.nextPeriod;

  // Filter messages sent by partner
  const partnerMessages = messages.filter(
    (m) => m.body && m.body.trim().length > 0
  );

  const unreadNotifications = notifications.filter((item) => !item.read_at);
  const notificationCategories = [
    { id: 'wants', title: 'Wants', icon: 'star-outline' as const, kinds: ['shared_want'] },
    { id: 'messages', title: 'Messages', icon: 'chatbubble-outline' as const, kinds: ['message', 'reply'] },
    { id: 'checkins', title: 'Check-ins', icon: 'heart-outline' as const, kinds: ['shared_checkin'] },
    { id: 'cycle', title: 'Period & Symptoms', icon: 'calendar-outline' as const, kinds: ['shared_cycle', 'shared_symptom'] },
    { id: 'between-us', title: 'Between Us', icon: 'people-outline' as const, kinds: ['shared_entry'] },
  ].map((category) => ({
    ...category,
    items: notifications.filter((item) => category.kinds.includes(item.kind)),
  })).filter((category) => category.items.length > 0);

  useEffect(() => {
    onUnreadCountChange?.(unreadNotifications.length);
  }, [onUnreadCountChange, unreadNotifications.length]);

  async function openNotification(item: RelationshipNotification) {
    try {
      if (!item.read_at) {
        await markRelationshipNotificationsRead([item.id]);
        setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
      }
      onClose();
      const route = item.kind === 'shared_checkin'
        ? '/check-in'
        : item.kind === 'shared_want'
          ? '/want'
          : item.kind === 'shared_entry'
            ? '/between-us'
          : item.kind === 'shared_cycle' || item.kind === 'shared_symptom'
            ? '/period'
            : '/messages';
      router.push(route as any);
    } catch (error) {
      console.error('Could not open notification:', error);
    }
  }

  async function markAllNotificationsRead() {
    const ids = unreadNotifications.map((item) => item.id);
    if (!ids.length) return;
    try {
      await markRelationshipNotificationsRead(ids);
      const now = new Date().toISOString();
      setNotifications((current) => current.map((row) => row.read_at ? row : { ...row, read_at: now }));
    } catch (error) {
      console.error('Could not mark notifications read:', error);
      Alert.alert('Could not update notifications', 'Please try again.');
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.bellIconWrap}>
                <Ionicons name="notifications" size={20} color="#F4768F" />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {viewerMode
                    ? "Boyfriend's Notification"
                    : "Girlfriend's Notification"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {viewerMode
                    ? "Her wants, messages, check-in & cycle"
                    : "His wants, messages & feelings for you"}
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#F4768F" size="small" />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* =======================================================
                  BOYFRIEND'S VIEW: GF'S PERIOD STATUS & LOGGED SYMPTOMS
                  ======================================================= */}
              {viewerMode && (periods.length > 0 || todaySymptoms.length > 0) ? (
                <View style={styles.cardPeriod}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#FDE7EC' }]}>
                      <Ionicons name="water" size={18} color="#F4768F" />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Gf&apos;s Period Status &amp; Symptoms</Text>
                      <Text style={styles.cardSub}>Real-time cycle & feeling</Text>
                    </View>
                  </View>

                  {periods.length > 0 ? (
                    <View style={styles.cycleBadgeRow}>
                      <View style={styles.cycleBadge}>
                        <Text style={styles.cycleBadgePhase}>
                          {phaseName} Phase
                        </Text>
                        {cycleDay ? (
                          <Text style={styles.cycleBadgeDay}>Day {cycleDay}</Text>
                        ) : null}
                      </View>

                      {nextExpected ? (
                        <View style={styles.cycleBadgeAlt}>
                          <Text style={styles.cycleBadgeLabel}>Next period</Text>
                          <Text style={styles.cycleBadgeVal}>{nextExpected}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Logged symptoms */}
                  {todaySymptoms.length > 0 ? (
                    <View style={styles.symptomsSection}>
                      <Text style={styles.subHeading}>Today&apos;s logged symptoms:</Text>
                      <View style={styles.chipsRow}>
                        {todaySymptoms.map((sym) => (
                          <View key={sym.id} style={styles.symptomChip}>
                            <Text style={styles.symptomChipText}>
                              {sym.symptom_type}
                              {sym.severity ? ` · ${sym.severity}` : ''}
                              {sym.mood ? ` · ${sym.mood}` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                </View>
              ) : null}

              {notifications.length > 0 || notificationError ? <View style={styles.cardNotifications}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.cardTitle}>Notifications</Text>
                  <View style={styles.notificationHeaderActions}>
                    {unreadNotifications.length ? (
                      <Pressable onPress={markAllNotificationsRead} hitSlop={8}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                      </Pressable>
                    ) : null}
                    {notifications.length > 0 ? (
                      <Pressable onPress={() => { onClose(); router.push('/notifications'); }} hitSlop={8}>
                        <Text style={styles.markAllText}>Open all</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {notificationError ? <Text style={styles.emptyNote}>{notificationError}</Text> : null}
                {notificationCategories.map((category) => {
                  const expanded = expandedNotificationCategory === category.id;
                  const unread = category.items.filter((item) => !item.read_at).length;
                  return (
                    <View key={category.id} style={styles.notificationCategory}>
                      <Pressable
                        onPress={() => setExpandedNotificationCategory(expanded ? null : category.id)}
                        style={styles.notificationCategoryButton}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                      >
                        <Ionicons name={category.icon} size={17} color="#7099E8" />
                        <Text style={styles.notificationCategoryTitle}>{category.title}</Text>
                        <Text style={styles.notificationCategoryCount}>{category.items.length}</Text>
                        {unread > 0 ? <View style={styles.notificationCategoryUnread}><Text style={styles.notificationCategoryUnreadText}>{unread}</Text></View> : null}
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                      </Pressable>
                      {expanded ? category.items.slice(0, 8).map((item) => (
                        <Pressable key={item.id} onPress={() => void openNotification(item)} style={styles.notificationRow}>
                          <View style={[styles.notificationDot, !item.read_at && styles.notificationDotUnread]} />
                          <View style={styles.notificationText}>
                            <Text style={styles.notificationTitle}>
                              {item.kind === 'reply' ? 'New reply' : item.kind === 'shared_checkin' ? 'Shared check-in' : item.kind === 'shared_want' ? 'New want' : item.kind === 'shared_cycle' ? 'Period update' : item.kind === 'shared_symptom' ? 'Symptom update' : item.kind === 'shared_entry' ? 'Between Us update' : 'New message'}
                            </Text>
                            <Text style={styles.notificationSub}>
                              {item.kind === 'shared_checkin' ? 'Your partner shared a check-in.' : item.kind === 'shared_want' ? 'Your partner added a want.' : item.kind === 'shared_cycle' ? 'Your partner updated period dates.' : item.kind === 'shared_symptom' ? 'Your partner logged a symptom.' : item.kind === 'shared_entry' ? 'Your partner added something to a shared space.' : 'Open your conversation with your partner.'}
                            </Text>
                            <Text style={styles.timeTag}>{formatTimeAgo(item.created_at)}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#A0A7B2" />
                        </Pressable>
                      )) : null}
                    </View>
                  );
                })}
              </View> : null}

              {/* =======================================================
                  WANTS SECTION:
                  Girlfriend sees: "Bf's wants"
                  Boyfriend sees: "Gf's wants"
                  ======================================================= */}
              {wants.length > 0 ? <View style={styles.cardWants}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FDECE7' }]}>
                    <Ionicons name="sparkles" size={18} color="#F29A82" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>
                      {viewerMode ? "Gf's Wants" : "Bf's Wants"}
                    </Text>
                    <Text style={styles.cardSub}>
                      {viewerMode
                        ? "Little wishes she would love from you"
                        : "Things he’s hoping to experience with you"}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsList}>
                    {wants.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleToggleWant(item.id)}
                        style={[
                          styles.wantItemRow,
                          item.fulfilled && styles.wantItemFulfilled,
                        ]}
                      >
                        <Ionicons
                          name={
                            item.fulfilled
                              ? 'checkmark-circle'
                              : 'ellipse-outline'
                          }
                          size={20}
                          color={item.fulfilled ? '#10B981' : '#F29A82'}
                        />
                        <View style={styles.wantTextGroup}>
                          <Text
                            style={[
                              styles.wantTitle,
                              item.fulfilled && styles.wantTitleDone,
                            ]}
                          >
                            {item.title}
                          </Text>
                          {item.note ? (
                            <Text style={styles.wantNote}>{item.note}</Text>
                          ) : null}
                          <View style={styles.wantMetaRow}>
                            <Text style={styles.wantTag}>
                              {item.category?.toUpperCase() || 'WISH'}
                            </Text>
                            <Text style={styles.timeTag}>
                              {formatTimeAgo(item.created_at)}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                </View>
              </View> : null}

              {/* =======================================================
                  MESSAGE SECTION:
                  Girlfriend sees: "Bf's Message"
                  Boyfriend sees: "Gf's Message"
                  ======================================================= */}
              {partnerMessages.length > 0 ? <View style={styles.cardMessage}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#EEF3FD' }]}>
                    <Ionicons name="mail" size={18} color="#7099E8" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>
                      {viewerMode ? "Gf's Message" : "Bf's Message"}
                    </Text>
                    <Text style={styles.cardSub}>Sweet notes & messages</Text>
                  </View>
                </View>

                <View style={styles.msgList}>
                    {partnerMessages.slice(0, 3).map((msg) => (
                      <View key={msg.id} style={styles.msgBubble}>
                        <Text style={styles.msgBody}>{msg.body}</Text>
                        <Text style={styles.msgTime}>
                          {formatTimeAgo(msg.created_at)}
                        </Text>
                      </View>
                    ))}
                </View>

                {onOpenCompose ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onOpenCompose(partnerMessages[0] || null);
                    }}
                    style={styles.replyBtn}
                  >
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.replyBtnText}>
                      {viewerMode ? "Reply to Gf" : "Reply to Bf"}
                    </Text>
                  </Pressable>
                ) : null}
              </View> : null}

              {/* =======================================================
                  CHECK-IN SECTION:
                  Girlfriend sees: "Bf's Check-in (Feeling about you)"
                  Boyfriend sees: "Gf's Check-in (Feeling about you)"
                  ======================================================= */}
              {checkIn ? <View style={styles.cardCheckIn}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0EBFB' }]}>
                    <Ionicons name="pulse" size={18} color="#A58BE0" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>
                      {viewerMode
                        ? "Gf's Check-in (Feeling about you)"
                        : "Bf's Check-in (Feeling about you)"}
                    </Text>
                    <Text style={styles.cardSub}>
                      How your partner is feeling right now
                    </Text>
                  </View>
                </View>

                <View style={styles.checkInBody}>
                    <View style={styles.feelingRow}>
                      <Text style={styles.feelingEmoji}>{checkIn.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.feelingTitle}>
                          {checkIn.feeling}
                        </Text>
                        <Text style={styles.feelingTime}>
                          Updated {formatTimeAgo(checkIn.updated_at)}
                        </Text>
                      </View>
                    </View>

                    {checkIn.note ? (
                      <View style={styles.quoteBox}>
                        <Text style={styles.quoteText}>“{checkIn.note}”</Text>
                      </View>
                    ) : null}

                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingLabel}>Connection Intensity</Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Ionicons
                            key={i}
                            name={i < (checkIn.intensity || 5) ? 'heart' : 'heart-outline'}
                            size={16}
                            color="#A58BE0"
                          />
                        ))}
                      </View>
                    </View>
                </View>
              </View> : null}

              <Pressable onPress={onClose} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Close</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FDE7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 16,
  },
  // Cards
  cardPeriod: {
    backgroundColor: '#FFF5F7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCE7EB',
    padding: 16,
  },
  cardWants: {
    backgroundColor: '#FFF9F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCECE7',
    padding: 16,
  },
  cardNotifications: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  notificationHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationCategory: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  notificationCategoryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9 },
  notificationCategoryTitle: { flex: 1, color: '#334155', fontSize: 13, fontWeight: '600' },
  notificationCategoryCount: { color: '#94A3B8', fontSize: 11, minWidth: 14, textAlign: 'right' },
  notificationCategoryUnread: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#E5609F', alignItems: 'center', justifyContent: 'center' },
  notificationCategoryUnreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  markAllText: { color: '#7099E8', fontSize: 12, fontWeight: '600' },
  notificationRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 10,
  },
  notificationDot: { width: 8, height: 8, borderRadius: 4, marginRight: 11, backgroundColor: '#D8DEE8' },
  notificationDotUnread: { backgroundColor: '#E5609F' },
  notificationText: { flex: 1, paddingRight: 8 },
  notificationTitle: { color: '#20273A', fontSize: 13, fontWeight: '600' },
  notificationSub: { color: '#64748B', fontSize: 11, marginTop: 3 },
  cardMessage: {
    backgroundColor: '#F6F9FE',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8F0FC',
    padding: 16,
  },
  cardCheckIn: {
    backgroundColor: '#FBF9FE',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1ECFA',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Cycle badge
  cycleBadgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  cycleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F7D8DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cycleBadgePhase: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4768F',
  },
  cycleBadgeDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  cycleBadgeAlt: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cycleBadgeLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  cycleBadgeVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  symptomsSection: {
    marginTop: 4,
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  symptomChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F7D8DF',
  },
  symptomChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FCE7EB',
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '500',
  },
  emptyNote: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginVertical: 6,
  },
  // Wants
  itemsList: {
    gap: 8,
  },
  wantItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3E8E2',
  },
  wantItemFulfilled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.7,
  },
  wantTextGroup: {
    flex: 1,
  },
  wantTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  wantTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  wantNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  wantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  wantTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F29A82',
    backgroundColor: '#FDECE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeTag: {
    fontSize: 11,
    color: '#94A3B8',
  },
  // Messages
  emptyMsgBlock: {
    paddingVertical: 4,
  },
  msgList: {
    gap: 8,
    marginBottom: 10,
  },
  msgBubble: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  msgBody: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'right',
  },
  replyBtn: {
    backgroundColor: '#7099E8',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  replyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Check in
  checkInBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE7F6',
  },
  feelingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feelingEmoji: {
    fontSize: 32,
  },
  feelingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  feelingTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  quoteBox: {
    backgroundColor: '#FAF8FD',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#A58BE0',
  },
  quoteText: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  doneButton: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
