import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AccountState, getAccountState } from '../lib/account';

import { colors, layout, radius, shadow, spacing, type } from '../lib/theme';
import {
  Card,
  FadeIn,
  IconButton,
  PressScale,
  Screen,
} from '../lib/ui';

const ROLES = ['boyfriend', 'girlfriend'] as const;

export default function HomeScreen() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const state = await getAccountState();
      setAccount(state);
    } catch (error) {
      console.error('HOME ACCOUNT ERROR:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
      const interval = setInterval(loadAccount, 5000);
      return () => clearInterval(interval);
    }, [loadAccount])
  );

  // UI only: start with the current user's card selected
  useEffect(() => {
    if (selected || !account?.members) return;
    const me = (account.members as any[]).find(
      (m) => m.user_id === account.user_id
    );
    if (me) setSelected(me.role);
  }, [account, selected]);

  async function shareCode() {
    const code = account?.pairing_code || account?.login_code;
    if (!code) return;

    await Share.share({
      message: `Join me on Between Us using this code: ${code}`,
    });
  }

  function openSettings() {
    router.push('/settings');
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.blue} />
        </View>
      </Screen>
    );
  }

  if (!account || account.status === 'new') {
    router.replace('/');
    return null;
  }

  const members = account.members || [];
  const isWaiting = account.status === 'waiting';
  const code = account.pairing_code || account.login_code || '------';
  const displayCode = hidden ? '••••••' : code;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR */}
        <FadeIn style={styles.topBar}>
          <View style={styles.brandMark}>
            <Ionicons name="heart" size={14} color={colors.red} />
          </View>

          <IconButton name="settings-outline" onPress={openSettings} />
        </FadeIn>

        {/* HEADER */}
        <FadeIn delay={60} style={styles.titleBlock}>
          <Text style={styles.title}>Between Us</Text>
          <Text style={styles.subtitle}>
            {isWaiting
              ? 'Your account is ready. Your partner can join with your code.'
              : 'Your shared space is connected.'}
          </Text>
        </FadeIn>

        {/* WHO'S USING */}
        <FadeIn delay={120}>
          <Text style={styles.sectionLabel}>Who's Using?</Text>

          <View style={styles.peopleRow}>
            {ROLES.map((role) => {
              const member = members.find((m: any) => m.role === role);
              const isYou = !!member && member.user_id === account.user_id;
              const isSelected = selected === role;

              const statusText = isYou
                ? 'You'
                : member
                ? 'Connected'
                : 'Waiting';

              const dotColor = isYou
                ? colors.blue
                : member
                ? colors.textFaint
                : colors.red;

              return (
                <PressScale
                  key={role}
                  onPress={() => setSelected(role)}
                  style={[styles.personCard, isSelected && styles.personCardActive]}
                  contentStyle={styles.personContent}
                >
                  {isSelected && (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={12} color={colors.white} />
                    </View>
                  )}

                  <View style={[styles.avatar, isSelected && styles.avatarActive]}>
                    {member?.name ? (
                      <Text
                        style={[
                          styles.avatarText,
                          isSelected && styles.avatarTextActive,
                        ]}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    ) : (
                      <Ionicons
                        name="person-outline"
                        size={26}
                        color={colors.textFaint}
                      />
                    )}
                  </View>

                  <Text style={styles.roleName}>
                    {role === 'boyfriend' ? 'Boyfriend' : 'Girlfriend'}
                  </Text>

                  <Text style={styles.memberName} numberOfLines={1}>
                    {member?.name || 'Not joined yet'}
                  </Text>

                  <View style={styles.statusPill}>
                    <View style={[styles.dot, { backgroundColor: dotColor }]} />
                    <Text style={styles.statusText}>{statusText}</Text>
                  </View>
                </PressScale>
              );
            })}
          </View>
        </FadeIn>

        {/* CODE */}
        <FadeIn delay={180}>
          <Card style={styles.codeCard}>
            <View style={styles.codeRow}>
              <View style={styles.codeTextBlock}>
                <Text style={styles.codeLabel}>
                  {isWaiting ? 'Pairing code' : 'Code'}
                </Text>
                <Text style={styles.code}>{displayCode}</Text>
              </View>

              <PressScale
                onPress={() => setHidden((h) => !h)}
                scaleTo={0.9}
                style={styles.eyeButton}
                contentStyle={styles.eyeButtonContent}
              >
                <Ionicons
                  name={hidden ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </PressScale>
            </View>

            <Text style={styles.codeHint}>
              {isWaiting
                ? 'Share this code with your partner so they can join.'
                : 'Keep this code somewhere safe.'}
            </Text>

            {isWaiting && (
              <PressScale
                onPress={shareCode}
                style={styles.shareButton}
                contentStyle={styles.shareButtonContent}
              >
                <Ionicons name="share-outline" size={18} color={colors.white} />
                <Text style={styles.shareButtonText}>Share code</Text>
              </PressScale>
            )}
          </Card>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 60,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },

  titleBlock: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },

  title: {
    ...type.display,
    color: colors.text,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
  },

  sectionLabel: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.md,
    ...type.title,
    fontSize: 17,
    color: colors.text,
  },

  peopleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  personCard: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow.soft,
  },

  personCardActive: {
    borderColor: colors.blue,
    ...shadow.card,
  },

  personContent: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
  },

  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarActive: {
    backgroundColor: colors.blueSoft,
  },

  avatarText: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.textMuted,
  },

  avatarTextActive: {
    color: colors.blue,
  },

  roleName: {
    marginTop: spacing.lg,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  memberName: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },

  statusPill: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },

  codeCard: {
    marginTop: spacing.xl,
    padding: spacing.xxl,
  },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  codeTextBlock: {
    flex: 1,
  },

  codeLabel: {
    ...type.label,
    fontSize: 12,
    color: colors.textFaint,
  },

  code: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 5,
    color: colors.text,
  },

  eyeButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },

  eyeButtonContent: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },

  codeHint: {
    marginTop: spacing.lg,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },

  shareButton: {
    marginTop: spacing.xl,
    height: layout.touch,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  shareButtonContent: {
    height: layout.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  shareButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});