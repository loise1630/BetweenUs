import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function generateCode() {
  const characters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let result = '';

  for (let i = 0; i < 6; i++) {
    result += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return result;
}

export default function CreateCodeScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    name?: string;
  }>();

  const code = useMemo(() => generateCode(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>♡</Text>
          </View>

          <Text style={styles.eyebrow}>CREATE AN INVITE</Text>

          <Text style={styles.title}>
            Invite your partner.
          </Text>

          <Text style={styles.subtitle}>
            Share this code with your partner to
            connect your spaces.
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>
              YOUR PAIRING CODE
            </Text>

            <Text style={styles.code}>
              {code}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/home',
                params: {
                  role: params.role,
                  name: params.name,
                  code,
                },
              })
            }
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              Continue
            </Text>

            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>
        </View>
      </View>
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
    paddingHorizontal: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E1E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  backText: {
    fontSize: 30,
    lineHeight: 32,
    color: '#6F5961',
    marginTop: -3,
  },

  content: {
    marginTop: 67,
  },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FBECEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },

  icon: {
    fontSize: 32,
    color: '#B56F84',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B47789',
    marginBottom: 9,
  },

  title: {
    fontSize: 33,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#2E282C',
  },

  subtitle: {
    marginTop: 10,
    maxWidth: 325,
    fontSize: 14,
    lineHeight: 21,
    color: '#8D7D84',
  },

  codeCard: {
    marginTop: 35,
    backgroundColor: '#F8F0F8',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDE0EF',
    paddingVertical: 27,
    alignItems: 'center',
  },

  codeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: '#AA8399',
    marginBottom: 10,
  },

  code: {
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#714C63',
  },

  button: {
    marginTop: 14,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#9E6377',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  buttonArrow: {
    marginLeft: 9,
    color: '#FFFFFF',
    fontSize: 19,
  },

  pressed: {
    opacity: 0.7,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});