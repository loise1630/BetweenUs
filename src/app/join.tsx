import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { CommonActions } from 'expo-router/react-navigation';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ensureAnonymousSession,
  getAccountState,
  saveAccountState,
} from '../lib/account';

import { supabase } from '../lib/supabase';

import { colors, layout, radius, spacing } from '../lib/theme';
import {
  BackButton,
  Card,
  FadeIn,
  Field,
  Heading,
  PrimaryButton,
  Screen,
  Segmented,
} from '../lib/ui';

type Role = 'girlfriend' | 'boyfriend';

export default function JoinScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanCode = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

  const canConnect =
    name.trim().length > 0 &&
    role !== null &&
    cleanCode.length === 6 &&
    !loading;

  async function handleConnect() {
    if (!canConnect || !role) return;

    try {
      setLoading(true);

      await ensureAnonymousSession();

      const { data, error } = await supabase.rpc('redeem_pairing_code', {
        p_code: cleanCode,
        p_name: name.trim(),
        p_role: role,
      });

      if (error) throw error;

      if (!data?.success || !data?.couple_id) {
        throw new Error('The pairing code could not be connected.');
      }

      const state = await getAccountState();
      await saveAccountState(state);

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'home' }],
        })
      );
    } catch (error: any) {
      console.error('JOIN PAIR ERROR:', error);

      let message =
        error?.message ||
        'Something went wrong while connecting your partner.';

      if (message.includes('Invalid or already used')) {
        message =
          'That pairing code is invalid, expired, or has already been used.';
      }

      if (message.includes('already paired')) {
        message = 'This account is already paired with someone.';
      }

      if (message.includes('own pairing code')) {
        message = 'You cannot use your own pairing code.';
      }

      Alert.alert('Unable to connect', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackButton onPress={() => router.back()} disabled={loading} />

          <FadeIn style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="link-outline" size={22} color={colors.blue} />
            </View>

            <Heading
              eyebrow="Join your partner"
              title="Enter their pairing code."
              subtitle="Add your name and role, then enter the six-character code they shared."
            />

            <Card style={styles.card}>
              <Field
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
                autoCorrect={false}
              />

              <View style={styles.gap}>
                <Text style={styles.label}>Your role</Text>
                <Segmented<Role>
                  value={role}
                  onChange={setRole}
                  options={[
                    { key: 'girlfriend', label: 'Girlfriend' },
                    { key: 'boyfriend', label: 'Boyfriend' },
                  ]}
                />
              </View>

              <View style={styles.gap}>
                <Field
                  label="Pairing code"
                  value={cleanCode}
                  onChangeText={setCode}
                  placeholder="······"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  textAlign="center"
                  style={styles.codeInput}
                />
                <Text style={styles.counter}>{cleanCode.length}/6</Text>
              </View>
            </Card>
          </FadeIn>
        </ScrollView>

        <View style={styles.bottom}>
          <PrimaryButton
            label="Connect Partner"
            onPress={handleConnect}
            disabled={!canConnect}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  content: {
    paddingTop: spacing.xl,
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },

  card: {
    marginTop: spacing.xxl,
  },

  gap: {
    marginTop: spacing.xl,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },

  codeInput: {
    height: 64,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 8,
    paddingHorizontal: 20,
  },

  counter: {
    marginTop: 8,
    marginRight: 4,
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.textFaint,
  },

  bottom: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
});