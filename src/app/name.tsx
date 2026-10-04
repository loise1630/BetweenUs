import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NameScreen() {
  const params = useLocalSearchParams<{
    role?: string;
  }>();

  const role =
    params.role === 'girlfriend'
      ? 'girlfriend'
      : params.role === 'boyfriend'
        ? 'boyfriend'
        : null;

  const [name, setName] = useState('');

  const canContinue =
    name.trim().length > 0 && role !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.content}>

          <Text style={styles.eyebrow}>
            NICE TO MEET YOU
          </Text>

          <Text style={styles.title}>
            What should we call you?
          </Text>

          <Text style={styles.subtitle}>
            Choose the name your partner will see
            inside Between Us.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#B7A7AE"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
          />

        </View>

        <Pressable
          disabled={!canContinue}
          style={[
            styles.button,
            !canContinue && styles.buttonDisabled,
          ]}
          onPress={() => {
            if (!role || !name.trim()) {
              return;
            }

            router.push({
              pathname: '/create-code',
              params: {
                role,
                name: name.trim(),
              },
            });
          }}
        >
          <Text style={styles.buttonText}>
            Continue
          </Text>
        </Pressable>

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
    paddingTop: 14,
    paddingBottom: 24,
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
  },

  backText: {
    marginTop: -3,
    fontSize: 31,
    fontWeight: '300',
    color: '#604A54',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B47789',
    marginBottom: 12,
  },

  title: {
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#30292D',
  },

  subtitle: {
    marginTop: 9,
    maxWidth: 310,
    fontSize: 14,
    lineHeight: 21,
    color: '#8E8189',
  },

  input: {
    marginTop: 28,
    height: 58,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECDDE3',
    paddingHorizontal: 17,
    fontSize: 16,
    color: '#342C31',
  },

  button: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#9E6377',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonDisabled: {
    backgroundColor: '#D9C5CC',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});