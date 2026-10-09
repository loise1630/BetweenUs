import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAccountState,
} from '../lib/account';

/**
 * Soft "blurred" blob built from stacked translucent ellipses
 * (no extra libraries needed).
 */
function SoftBlob({
  width,
  height,
  color,
  style,
}: {
  width: number;
  height: number;
  color: string;
  style?: ViewStyle;
}) {
  const layers = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
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
              opacity: 0.09,
            }}
          />
        );
      })}
    </View>
  );
}

export default function LandingScreen() {
  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkExistingAccount() {
      try {
        const state =
          await getAccountState();

        if (!mounted) {
          return;
        }

        if (
          state.status === 'waiting' ||
          state.status === 'paired'
        ) {
          router.replace('/home');
          return;
        }
      } catch (error) {
        console.log(
          'ACCOUNT CHECK:',
          error
        );
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkExistingAccount();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="small"
            color="#E5609F"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.wordmark}>
            Between
            <Text style={styles.wordmarkAccent}>
              Us
            </Text>
          </Text>

          <Text style={styles.tagline}>
            For everything you don't always know how to say.
          </Text>
        </View>

        <View style={styles.visual}>
          <View style={styles.blobArea}>
            <SoftBlob
              width={200}
              height={190}
              color="#7FA2F2"
              style={styles.blueBlob}
            />

            <SoftBlob
              width={200}
              height={190}
              color="#FF8FA8"
              style={styles.pinkBlob}
            />

            <View style={styles.lens} />
          </View>
        </View>

        <View style={styles.actions}>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              router.push('/get-started');
            }}
          >
            <Text style={styles.primaryText}>
              Get Started
            </Text>
            <Feather
              name="arrow-right"
              size={22}
              color="#FFFFFF"
              style={styles.primaryArrow}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              router.push('/join');
            }}
          >
            <Feather
              name="link"
              size={20}
              color="#17181C"
              style={styles.secondaryIcon}
            />
            <Text style={styles.secondaryText}>
              Join with a pairing code
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              router.push('/login-code');
            }}
          >
            <Text style={styles.loginText}>
              Login with code
            </Text>
            <Feather
              name="arrow-right"
              size={16}
              color="#6B7280"
              style={styles.loginArrow}
            />
          </Pressable>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FDFDFB',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginTop: 72,
  },

  wordmark: {
    fontSize: 46,
    fontWeight: '600',
    letterSpacing: -1.8,
    color: '#121217',
  },

  wordmarkAccent: {
    color: '#E5609F',
  },

  tagline: {
    marginTop: 26,
    maxWidth: 250,
    textAlign: 'center',
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '300',
    color: '#5B6470',
  },

  visual: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  blobArea: {
    width: 300,
    height: 260,
  },

  blueBlob: {
    position: 'absolute',
    left: 0,
    top: 20,
  },

  pinkBlob: {
    position: 'absolute',
    left: 100,
    top: 50,
  },

  lens: {
    position: 'absolute',
    left: 108,
    top: 65,
    width: 84,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(150, 140, 225, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(150, 140, 225, 0.35)',
    transform: [{ rotate: '35deg' }],
  },

  actions: {
    gap: 16,
  },

  primaryButton: {
    height: 62,
    borderRadius: 31,
    backgroundColor: '#17181C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },

  primaryArrow: {
    position: 'absolute',
    right: 28,
  },

  secondaryButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C9D2E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryIcon: {
    marginRight: 14,
  },

  secondaryText: {
    color: '#17181C',
    fontSize: 17,
    fontWeight: '400',
  },

  loginButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '400',
  },

  loginArrow: {
    marginLeft: 10,
  },

  pressed: {
    opacity: 0.75,
  },
});