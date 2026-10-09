import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
  useNavigation,
} from 'expo-router';

import { CommonActions } from 'expo-router/react-navigation';
import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ensureAnonymousSession,
  getAccountState,
  saveAccountState,
} from '../lib/account';

import { supabase } from '../lib/supabase';

import { colors, layout, radius, shadow, spacing, type } from '../lib/theme';
import { BackButton, FadeIn, PressScale } from '../lib/ui';

export default function CreateCodeScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    name?: string;
  }>();

  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!params.role || !params.name) {
      Alert.alert(
        'Missing information',
        'Please go back and complete your name and role.'
      );
      return;
    }

    try {
      setLoading(true);

      await ensureAnonymousSession();

      const { data, error } = await supabase.rpc('create_pairing_invite', {
        p_name: String(params.name),
        p_role: params.role,
      });

      if (error) throw error;

      if (!data?.success || !data?.code) {
        throw new Error('Unable to create your pairing code.');
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
      console.error('CREATE CODE ERROR:', error);

      Alert.alert(
        'Unable to create account',
        error?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} disabled={loading} />

        <FadeIn style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart-outline" size={26} color={colors.red} />
          </View>

          <Text style={styles.eyebrow}>Create an invite</Text>
          <Text style={styles.title}>Invite your partner.</Text>
          <Text style={styles.subtitle}>
            Your pairing code will stay connected to your Between Us account.
          </Text>

          <View style={styles.codeCard}>
            <View style={styles.lockRow}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={colors.textFaint}
              />
              <Text style={styles.codeLabel}>Your pairing code</Text>
            </View>

            <Text style={styles.code}>••••••</Text>

            <Text style={styles.codeHint}>
              Your real code will be created securely by Between Us.
            </Text>
          </View>
        </FadeIn>

        <View style={styles.bottom}>
          <PressScale
            disabled={loading}
            onPress={handleCreate}
            style={[styles.button, loading && styles.buttonDisabled]}
            contentStyle={styles.buttonContent}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create My Account</Text>
            )}
          </PressScale>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
  },

  content: {
    flex: 1,
    paddingTop: spacing.xxxl + spacing.md,
  },

  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },

  eyebrow: {
    ...type.label,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.red,
    marginBottom: spacing.sm,
  },

  title: {
    ...type.display,
    color: colors.text,
  },

  subtitle: {
    marginTop: spacing.sm,
    maxWidth: 325,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },

  codeCard: {
    marginTop: spacing.xxxl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },

  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  codeLabel: {
    ...type.label,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textFaint,
  },

  code: {
    marginTop: spacing.md,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.text,
  },

  codeHint: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },

  bottom: {
    paddingBottom: spacing.xl,
  },

  button: {
    height: layout.touch + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.soft,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonContent: {
    height: layout.touch + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});