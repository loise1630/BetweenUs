import { Ionicons } from '@expo/vector-icons';

import {
    router,
    useNavigation,
} from 'expo-router';

import { CommonActions } from 'expo-router/react-navigation';

import { useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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

export default function LoginCodeScreen() {
  const navigation = useNavigation();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const cleanCode = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

  const canLogin = cleanCode.length === 6 && !loading;

  async function handleLogin() {
    if (!canLogin) {
      return;
    }

    try {
      setLoading(true);

      /*
       * We intentionally create/use a fresh anonymous
       * device session here. The database then maps that
       * session to the existing Between Us account.
       */
      await supabase.auth.signOut({
        scope: 'local',
      });

      await ensureAnonymousSession();

      const { data, error } = await supabase.rpc('recover_account_by_code', {
        p_code: cleanCode,
      });

      if (error) {
        throw error;
      }

      if (!data || !data.status || data.status === 'new') {
        throw new Error(
          'That login code is not connected to a Between Us account.'
        );
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
      console.error('LOGIN CODE ERROR:', error);

      Alert.alert(
        'Unable to login',
        error?.message ||
          'That code is invalid or could not restore the account.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
              <Ionicons name="key-outline" size={26} color={colors.blue} />
            </View>

            <Text style={styles.eyebrow}>Welcome back</Text>

            <Text style={styles.title}>Login with your code.</Text>

            <Text style={styles.subtitle}>
              Enter the Between Us code connected to your account.
            </Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Your code</Text>

              <View style={styles.codeWrapper}>
                <TextInput
                  value={cleanCode}
                  onChangeText={setCode}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="······"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  textAlign="center"
                  style={[styles.codeInput, focused && styles.inputFocused]}
                />

                <Text style={styles.counter}>{cleanCode.length}/6</Text>
              </View>
            </View>
          </FadeIn>
        </ScrollView>

        <View style={styles.bottom}>
          <PressScale
            disabled={!canLogin}
            onPress={handleLogin}
            style={[styles.button, !canLogin && styles.buttonDisabled]}
            contentStyle={styles.buttonContent}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.buttonText}>Login</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </>
            )}
          </PressScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxxl,
  },

  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.blueSoft,
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
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },

  card: {
    marginTop: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },

  fieldLabel: {
    ...type.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },

  codeWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },

  codeInput: {
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.text,
    paddingHorizontal: 44,
  },

  inputFocused: {
    borderColor: colors.blue,
    backgroundColor: colors.surface,
  },

  counter: {
    position: 'absolute',
    right: 16,
    bottom: 10,
    fontSize: 11,
    color: colors.textFaint,
  },

  bottom: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  button: {
    height: layout.touch + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.soft,
  },

  buttonDisabled: {
    opacity: 0.4,
  },

  buttonContent: {
    height: layout.touch + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});