import { Ionicons } from '@expo/vector-icons';

import { router, useFocusEffect } from 'expo-router';

import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AccountState, getAccountState } from '../lib/account';

import {
  colors,
  layout,
  radius,
  shadow,
  spacing,
  type,
} from '../lib/theme';

import {
  Card,
  FadeIn,
  IconButton,
  PressScale,
  Screen,
} from '../lib/ui';

const ROLES = ['boyfriend', 'girlfriend'] as const;

type Role = (typeof ROLES)[number];

export default function HomeScreen() {
  const [account, setAccount] =
    useState<AccountState | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [hidden, setHidden] =
    useState(true);

  const loadAccount = useCallback(async () => {
    try {
      const state =
        await getAccountState();

      setAccount(state);
    } catch (error) {
      console.error(
        'HOME ACCOUNT ERROR:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();

      const interval =
        setInterval(
          loadAccount,
          5000
        );

      return () =>
        clearInterval(interval);
    }, [loadAccount])
  );

  async function shareCode() {
    const code =
      account?.pairing_code ||
      account?.login_code;

    if (!code) {
      return;
    }

    await Share.share({
      message:
        `Join me on Between Us using this code: ${code}`,
    });
  }

  function openSettings() {
    router.push('/settings');
  }

  function openRole(role: Role) {
    if (role === 'boyfriend') {
      router.push('/boyfriend');
      return;
    }

    router.push('/girlfriend');
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.blue}
          />
        </View>
      </Screen>
    );
  }

  if (
    !account ||
    account.status === 'new'
  ) {
    router.replace('/');
    return null;
  }

  const members =
    account.members || [];

  const isWaiting =
    account.status === 'waiting';

  const code =
    account.pairing_code ||
    account.login_code ||
    '------';

  const displayCode =
    hidden
      ? '••••••'
      : code;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR */}

        <FadeIn style={styles.topBar}>
          <View style={styles.brandMark}>
            <Ionicons
              name="heart"
              size={14}
              color={colors.red}
            />
          </View>

          <IconButton
            name="settings-outline"
            onPress={openSettings}
          />
        </FadeIn>

        {/* HEADER */}

        <FadeIn
          delay={60}
          style={styles.titleBlock}
        >
          <Text style={styles.title}>
            Between Us
          </Text>

          <Text style={styles.subtitle}>
            {isWaiting
              ? 'Your account is ready. Your partner can join with your code.'
              : 'Choose who you are to continue.'}
          </Text>
        </FadeIn>

        {/* WHO'S USING */}

        <FadeIn delay={120}>
          <Text style={styles.sectionLabel}>
            Who's Using?
          </Text>

          <View style={styles.peopleRow}>
            {ROLES.map((role) => {
              const member =
                members.find(
                  (m: any) =>
                    m.role === role
                );

              const isYou =
                !!member &&
                member.user_id ===
                  account.user_id;

              const statusText =
                isYou
                  ? 'You'
                  : member
                  ? 'Connected'
                  : 'Waiting';

              const dotColor =
                isYou
                  ? colors.blue
                  : member
                  ? colors.textFaint
                  : colors.red;

              const roleName =
                role === 'boyfriend'
                  ? 'Boyfriend'
                  : 'Girlfriend';

              return (
                <PressScale
                  key={role}
                  onPress={() =>
                    openRole(role)
                  }
                  scaleTo={0.96}
                  style={
                    styles.personCard
                  }
                  contentStyle={
                    styles.personContent
                  }
                >
                  <View
                    style={
                      styles.roleIconWrap
                    }
                  >
                    <Ionicons
                      name={
                        role ===
                        'boyfriend'
                          ? 'person-outline'
                          : 'person-outline'
                      }
                      size={30}
                      color={
                        colors.textMuted
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.roleName
                    }
                  >
                    {roleName}
                  </Text>

                  <Text
                    style={
                      styles.memberName
                    }
                    numberOfLines={1}
                  >
                    {member?.name ||
                      'Not joined yet'}
                  </Text>

                  <View
                    style={
                      styles.statusPill
                    }
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            dotColor,
                        },
                      ]}
                    />

                    <Text
                      style={
                        styles.statusText
                      }
                    >
                      {statusText}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.enterRow
                    }
                  >
                    <Text
                      style={
                        styles.enterText
                      }
                    >
                      Open
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={
                        colors.textMuted
                      }
                    />
                  </View>
                </PressScale>
              );
            })}
          </View>
        </FadeIn>

        {/* CODE */}

        <FadeIn delay={180}>
          <Card
            style={[
              styles.codeCard,
              !isWaiting &&
                styles.codeCardCompact,
            ]}
          >
            <View
              style={styles.codeRow}
            >
              <View
                style={
                  styles.codeTextBlock
                }
              >
                <Text
                  style={
                    styles.codeLabel
                  }
                >
                  {isWaiting
                    ? 'Pairing code'
                    : 'Account code'}
                </Text>

                <Text
                  style={[
                    styles.code,
                    !isWaiting &&
                      styles.codeCompact,
                  ]}
                >
                  {displayCode}
                </Text>
              </View>

              <PressScale
                onPress={() =>
                  setHidden(
                    (h) => !h
                  )
                }
                scaleTo={0.9}
                style={
                  styles.eyeButton
                }
                contentStyle={
                  styles.eyeButtonContent
                }
              >
                <Ionicons
                  name={
                    hidden
                      ? 'eye-outline'
                      : 'eye-off-outline'
                  }
                  size={20}
                  color={
                    colors.textMuted
                  }
                />
              </PressScale>
            </View>

            {isWaiting ? (
              <>
                <Text
                  style={
                    styles.codeHint
                  }
                >
                  Share this code with
                  your partner so they
                  can join.
                </Text>

                <PressScale
                  onPress={shareCode}
                  style={
                    styles.shareButton
                  }
                  contentStyle={
                    styles.shareButtonContent
                  }
                >
                  <Ionicons
                    name="share-outline"
                    size={18}
                    color={
                      colors.white
                    }
                  />

                  <Text
                    style={
                      styles.shareButtonText
                    }
                  >
                    Share code
                  </Text>
                </PressScale>
              </>
            ) : null}
          </Card>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal:
      layout.screenPadding,
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
    justifyContent:
      'space-between',
  },

  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor:
      colors.surface,
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
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.surfaceAlt,
    ...shadow.soft,
  },

  personContent: {
    alignItems: 'center',
    paddingVertical:
      spacing.xxl,
    paddingHorizontal:
      spacing.md,
  },

  roleIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor:
      colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor:
      colors.surfaceAlt,
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

  enterRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  enterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },

  codeCard: {
    marginTop: spacing.xl,
    padding: spacing.xxl,
  },

  codeCardCompact: {
    paddingVertical: spacing.lg,
    paddingHorizontal:
      spacing.xl,
  },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
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

  codeCompact: {
    marginTop: 5,
    fontSize: 18,
    letterSpacing: 3,
  },

  eyeButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor:
      colors.surfaceAlt,
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
    backgroundColor:
      colors.primary,
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