import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountState, getAccountState } from '../lib/account';

const ROLES = ['boyfriend', 'girlfriend'] as const;
type Role = (typeof ROLES)[number];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const fadeUp = (value: Animated.Value, distance = 18) => ({
  opacity: value,
  transform: [
    {
      translateY: value.interpolate({
        inputRange: [0, 1],
        outputRange: [distance, 0],
      }),
    },
  ],
});

const springPress = (value: Animated.Value, toValue: number) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: true,
    speed: 40,
    bounciness: 6,
  }).start();

/* -------------------------------------------------------------------------- */
/*  Soft glow blob (gently floating)                                          */
/* -------------------------------------------------------------------------- */

const SoftBlob = memo(function SoftBlob({
  width,
  height,
  color,
  style,
  delay = 0,
  travel = 10,
  duration = 3600,
}: {
  width: number;
  height: number;
  color: string;
  style?: ViewStyle;
  delay?: number;
  travel?: number;
  duration?: number;
}) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, delay, duration]);

  const layers = [1, 0.86, 0.72, 0.58, 0.44];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width, height },
        style,
        {
          transform: [
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [-travel, travel],
              }),
            },
            {
              translateX: float.interpolate({
                inputRange: [0, 1],
                outputRange: [travel * 0.5, -travel * 0.5],
              }),
            },
          ],
        },
      ]}
    >
      {layers.map((scale) => {
        const w = width * scale;
        const h = height * scale;
        return (
          <View
            key={scale}
            style={{
              position: 'absolute',
              width: w,
              height: h,
              left: (width - w) / 2,
              top: (height - h) / 2,
              borderRadius: Math.max(w, h) / 2,
              backgroundColor: color,
              opacity: 0.07,
            }}
          />
        );
      })}
    </Animated.View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Role card                                                                 */
/* -------------------------------------------------------------------------- */

const RoleCard = memo(function RoleCard({
  title,
  handle,
  selected,
  avatarBg,
  iconColor,
  disabled = false,
  onPress,
}: {
  title: string;
  handle: string;
  selected: boolean;
  avatarBg: string;
  iconColor: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  // non-native (colors / shadow)
  const sel = useRef(new Animated.Value(selected ? 1 : 0)).current;
  // native (scale)
  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;

  const first = useRef(true);

  useEffect(() => {
    Animated.timing(sel, {
      toValue: selected ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.spring(pop, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 14,
    }).start();

    if (!first.current && selected) {
      press.setValue(0.94);
      springPress(press, 1);
    }
    first.current = false;
  }, [selected, sel, pop, press]);

  const backgroundColor = sel.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFF5F7'],
  });
  const borderColor = sel.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E8ECF2', '#FFA3BA'],
  });
  const shadowOpacity = sel.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.2],
  });

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => !disabled && springPress(press, 0.96)}
      onPressOut={() => !disabled && springPress(press, 1)}
      accessibilityState={{ disabled, selected }}
      style={[styles.roleCardWrap, disabled && styles.roleCardDisabled, { transform: [{ scale: press }] }]}
    >
      <Animated.View
        style={[
          styles.roleCard,
          { backgroundColor, borderColor, shadowOpacity },
        ]}
      >
        {/* check badge */}
        <Animated.View
          style={[
            styles.checkBadge,
            {
              opacity: pop,
              transform: [{ scale: pop }],
            },
          ]}
        >
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        </Animated.View>

        <Animated.View
          style={[
            styles.avatarWrap,
            {
              backgroundColor: avatarBg,
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="person" size={38} color={iconColor} />
        </Animated.View>

        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleHandle} numberOfLines={1}>
          {handle}
        </Text>
      </Animated.View>
    </AnimatedPressable>
  );
});

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function HomeScreen() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role>('boyfriend');

  // entrance animation values: header, roles, code, button
  const entrance = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0))
  ).current;

  // code reveal + eye / button micro-interactions
  const codeFade = useRef(new Animated.Value(1)).current;
  const eyePress = useRef(new Animated.Value(1)).current;
  const backPress = useRef(new Animated.Value(1)).current;
  const buttonPress = useRef(new Animated.Value(1)).current;
  const arrowNudge = useRef(new Animated.Value(0)).current;

  const loadAccount = useCallback(async () => {
    try {
      const state = await getAccountState();
      setAccount(state);

      if (state?.role && ROLES.includes(state.role as Role)) {
        setSelectedRole(state.role as Role);
      }
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

  // redirect safely (not during render)
  useEffect(() => {
    if (!loading && (!account || account.status === 'new')) {
      router.replace('/');
    }
  }, [loading, account]);

  // staggered entrance once data is ready
  const ready = !loading && !!account && account.status !== 'new';
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!ready || hasEntered.current) return;
    hasEntered.current = true;

    Animated.stagger(
      90,
      entrance.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [ready, entrance]);

  // arrow nudge loop on the continue button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(arrowNudge, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(arrowNudge, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [arrowNudge]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    router.push({ pathname: '/period', params: { role: selectedRole } });
  };

  const toggleHidden = () => {
    Animated.timing(codeFade, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setHidden((prev) => !prev);
      Animated.timing(codeFade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  if (loading || !account || account.status === 'new') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator color="#FF5B84" />
        </View>
      </SafeAreaView>
    );
  }

  const members = account.members || [];
  const boyfriendMember = members.find((m) => m.role === 'boyfriend');
  const girlfriendMember = members.find((m) => m.role === 'girlfriend');
  const selectedMember = members.find((m) => m.role === selectedRole);
  const partnerMember = members.find(
    (m) => m.role !== selectedRole && m.user_id !== selectedMember?.user_id
  );
  const canContinue =
    account.status === 'paired' &&
    account.role === selectedRole &&
    !!selectedMember &&
    !!partnerMember;

  const toHandle = (name?: string | null, fallback = '@user') =>
    name ? `@${name.toLowerCase().replace(/\s+/g, '')}` : fallback;

  const boyfriendHandle = toHandle(boyfriendMember?.name, '@user1');
  const girlfriendHandle = toHandle(girlfriendMember?.name, '@user2');

  const code = account.pairing_code || account.login_code || '------';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Floating background glow */}
      <View style={styles.blobBackground} pointerEvents="none">
        <SoftBlob
          width={210}
          height={210}
          color="#818CF8"
          style={styles.purpleBlob}
          travel={9}
          duration={4200}
        />
        <SoftBlob
          width={220}
          height={220}
          color="#FB7185"
          style={styles.pinkBlob}
          delay={600}
          travel={12}
          duration={3800}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Navigation */}
        <Animated.View style={[styles.navBar, fadeUp(entrance[0], 10)]}>
          <AnimatedPressable
            onPress={handleBack}
            onPressIn={() => springPress(backPress, 0.88)}
            onPressOut={() => springPress(backPress, 1)}
            style={[styles.backButton, { transform: [{ scale: backPress }] }]}
            hitSlop={14}
          >
            <Ionicons name="chevron-back" size={22} color="#18181B" />
          </AnimatedPressable>
        </Animated.View>

        {/* Wordmark Header */}
        <Animated.View style={[styles.header, fadeUp(entrance[0])]}>
          <Text style={styles.wordmark}>
            Between<Text style={styles.wordmarkAccent}>Us</Text>
          </Text>
          <Text style={styles.subtitle}>Your connected role is selected automatically</Text>
        </Animated.View>

        {/* WHO'S USING? */}
        <Animated.View style={[styles.sectionContainer, fadeUp(entrance[1])]}>
          <Text style={styles.sectionTitle}>WHO’S USING?</Text>

          <View style={styles.rolesRow}>
            <RoleCard
              title="Boyfriend"
              handle={boyfriendHandle}
              selected={selectedRole === 'boyfriend'}
              avatarBg="#FDE2E8"
              iconColor="#F472B6"
              disabled={account.role !== 'boyfriend'}
              onPress={() => setSelectedRole('boyfriend')}
            />
            <RoleCard
              title="Girlfriend"
              handle={girlfriendHandle}
              selected={selectedRole === 'girlfriend'}
              avatarBg="#EDE9FE"
              iconColor="#A5B4FC"
              disabled={account.role !== 'girlfriend'}
              onPress={() => setSelectedRole('girlfriend')}
            />
          </View>
        </Animated.View>

        {/* ACCOUNT CODE */}
        <Animated.View style={[styles.accountCodeSection, fadeUp(entrance[2])]}>
          <Text style={styles.sectionTitle}>ACCOUNT CODE</Text>

          <View style={styles.codePill}>
            <Animated.View
              style={{
                flex: 1,
                opacity: codeFade,
                transform: [
                  {
                    translateY: codeFade.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 0],
                    }),
                  },
                ],
              }}
            >
              <Text
                style={hidden ? styles.codeDotsText : styles.codePlain}
                numberOfLines={1}
              >
                {hidden ? '• • • • • •' : code}
              </Text>
            </Animated.View>

            <AnimatedPressable
              onPress={toggleHidden}
              onPressIn={() => springPress(eyePress, 0.82)}
              onPressOut={() => springPress(eyePress, 1)}
              style={[styles.eyeButton, { transform: [{ scale: eyePress }] }]}
              hitSlop={12}
            >
              <Ionicons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={21}
                color="#475569"
              />
            </AnimatedPressable>
          </View>
        </Animated.View>

        <View style={styles.flexSpacer} />

        {/* Continue Button */}
        <Animated.View style={[styles.actionContainer, fadeUp(entrance[3], 24)]}>
          {!canContinue ? (
            <Text style={styles.connectionHint}>
              {account.status === 'waiting'
                ? 'Connect your partner using your account code to continue.'
                : 'Both partner accounts must be connected before you can continue.'}
            </Text>
          ) : null}
          <AnimatedPressable
            disabled={!canContinue}
            onPress={handleContinue}
            onPressIn={() => springPress(buttonPress, 0.97)}
            onPressOut={() => springPress(buttonPress, 1)}
            style={[
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
              { transform: [{ scale: buttonPress }] },
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Animated.View
              style={[
                styles.continueArrow,
                {
                  transform: [
                    {
                      translateX: arrowNudge.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 5],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
            </Animated.View>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  blobBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 260,
    height: 260,
  },

  purpleBlob: {
    position: 'absolute',
    top: -30,
    right: 50,
  },

  pinkBlob: {
    position: 'absolute',
    top: 10,
    right: -40,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF0F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 36,
  },

  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#18181B',
    textAlign: 'center',
  },

  wordmarkAccent: {
    color: '#FF5B84',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '400',
  },

  sectionContainer: {
    width: '100%',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },

  rolesRow: {
    flexDirection: 'row',
    gap: 16,
  },

  roleCardWrap: {
    flex: 1,
  },

  roleCardDisabled: {
    opacity: 0.58,
  },

  roleCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingVertical: 30,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5B84',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF5B84',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },

  roleHandle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  accountCodeSection: {
    marginTop: 36,
    width: '100%',
  },

  codePill: {
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
    paddingRight: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  codeDotsText: {
    fontSize: 22,
    letterSpacing: 5,
    color: '#1E293B',
    fontWeight: '700',
  },

  codePlain: {
    fontSize: 18,
    letterSpacing: 4,
    color: '#1E293B',
    fontWeight: '700',
  },

  eyeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  flexSpacer: {
    flex: 1,
    minHeight: 36,
  },

  actionContainer: {
    width: '100%',
    paddingTop: 12,
  },

  connectionHint: {
    marginBottom: 12,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },

  continueButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: '#18181B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#18181B',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  continueButtonDisabled: {
    backgroundColor: '#AEB4BE',
    shadowOpacity: 0,
    elevation: 0,
  },

  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  continueArrow: {
    position: 'absolute',
    right: 24,
  },
});
