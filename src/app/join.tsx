import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

type Role = 'girlfriend' | 'boyfriend';

export default function JoinScreen() {
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
    if (!canConnect || !role) {
      return;
    }

    try {
      setLoading(true);

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } =
          await supabase.auth.signInAnonymously();

        if (error) {
          throw error;
        }

        session = data.session;
      }

      if (!session) {
        throw new Error(
          'Could not create your session. Please try again.'
        );
      }

      const { data, error } =
        await supabase.rpc('redeem_pairing_code', {
          p_code: cleanCode,
          p_name: name.trim(),
          p_role: role,
        });

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.couple_id) {
        throw new Error(
          'The pairing code could not be connected.'
        );
      }

      router.replace({
        pathname: '/home',
        params: {
          role,
          name: name.trim(),
          coupleId: data.couple_id,
        },
      });

    } catch (error: any) {
      console.error('JOIN PAIR ERROR:', error);

      let message =
        error?.message ||
        'Something went wrong while connecting your partner.';

      if (
        message.includes('Invalid or already used')
      ) {
        message =
          'That pairing code is invalid, expired, or has already been used.';
      }

      if (
        message.includes('already paired')
      ) {
        message =
          'This account is already paired with someone.';
      }

      if (
        message.includes('own pairing code')
      ) {
        message =
          'You cannot use your own pairing code.';
      }

      Alert.alert(
        'Unable to connect',
        message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#3A3035"
          />
        </Pressable>

        <View style={styles.content}>

          <View style={styles.iconCircle}>
            <Ionicons
              name="link-outline"
              size={30}
              color="#C87591"
            />
          </View>

          <Text style={styles.eyebrow}>
            JOIN YOUR PARTNER
          </Text>

          <Text style={styles.title}>
            Enter their pairing code.
          </Text>

          <Text style={styles.subtitle}>
            Add your name and role, then enter the
            six-character code they shared with you.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#B5A5AC"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.roleRow}>

            <Pressable
              onPress={() => setRole('girlfriend')}
              style={[
                styles.roleButton,
                role === 'girlfriend' &&
                  styles.roleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  role === 'girlfriend' &&
                    styles.roleTextActive,
                ]}
              >
                Girlfriend
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRole('boyfriend')}
              style={[
                styles.roleButton,
                role === 'boyfriend' &&
                  styles.roleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  role === 'boyfriend' &&
                    styles.roleTextActive,
                ]}
              >
                Boyfriend
              </Text>
            </Pressable>

          </View>

          <View style={styles.codeInputWrapper}>
            <TextInput
              value={cleanCode}
              onChangeText={setCode}
              placeholder="PAIRING CODE"
              placeholderTextColor="#BBAAB1"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              textAlign="center"
              style={styles.codeInput}
            />

            {cleanCode.length > 0 && (
              <Text style={styles.codeCount}>
                {cleanCode.length}/6
              </Text>
            )}
          </View>

        </View>

        <View style={styles.bottom}>

          <Pressable
            disabled={!canConnect}
            onPress={handleConnect}
            style={({ pressed }) => [
              styles.button,
              !canConnect &&
                styles.buttonDisabled,
              pressed &&
                canConnect &&
                styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Text style={styles.buttonText}>
                  Connect Partner
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#FFFFFF"
                />
              </>
            )}
          </Pressable>

        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9FB',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0E1E6',
  },

  content: {
    flex: 1,
    paddingTop: 35,
  },

  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F9E7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B47789',
    marginBottom: 9,
  },

  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '700',
    color: '#30272C',
    letterSpacing: -0.6,
  },

  subtitle: {
    marginTop: 11,
    fontSize: 14,
    lineHeight: 21,
    color: '#81757B',
    maxWidth: 350,
  },

  input: {
    marginTop: 27,
    height: 56,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DDE4',
    paddingHorizontal: 17,
    fontSize: 15,
    color: '#342C31',
  },

  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  roleButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EBDDE2',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleButtonActive: {
    backgroundColor: '#F7E5EB',
    borderColor: '#C87591',
  },

  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7C83',
  },

  roleTextActive: {
    color: '#9C5D74',
  },

  codeInputWrapper: {
    marginTop: 15,
    minHeight: 76,
    borderRadius: 19,
    backgroundColor: '#F8F0F8',
    borderWidth: 1,
    borderColor: '#EDE0EF',
    justifyContent: 'center',
    position: 'relative',
  },

  codeInput: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#714C63',
    paddingHorizontal: 45,
  },

  codeCount: {
    position: 'absolute',
    right: 13,
    bottom: 8,
    fontSize: 9,
    color: '#B39DA7',
  },

  bottom: {
    paddingBottom: 22,
    paddingTop: 12,
  },

  button: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#C87591',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  buttonDisabled: {
    opacity: 0.4,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },

  pressed: {
    opacity: 0.75,
  },
});