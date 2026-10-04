import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function CoupleScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    name?: string;
  }>();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');

  const role = params.role ?? '';
  const name = params.name ?? '';

  const handleContinue = () => {
    if (mode === 'join') {
      const cleanCode = code.trim().toUpperCase();

      if (!cleanCode) return;

      router.push({
        pathname: '/join',
        params: {
          role,
          name,
          code: cleanCode,
        },
      });

      return;
    }

    router.push({
      pathname: '/join',
      params: {
        role,
        name,
        mode: 'create',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color="#3A3035" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart-outline" size={28} color="#C87591" />
          </View>

          <Text style={styles.title}>Connect with your partner</Text>

          <Text style={styles.subtitle}>
            Create an invite code for your partner, or enter the code they
            already gave you.
          </Text>

          <View style={styles.options}>
            <Pressable
              onPress={() => setMode('create')}
              style={({ pressed }) => [
                styles.option,
                mode === 'create' && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  mode === 'create' && styles.optionIconSelected,
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={mode === 'create' ? '#FFFFFF' : '#C87591'}
                />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Create an invite</Text>
                <Text style={styles.optionDescription}>
                  Generate a code and give it to your partner.
                </Text>
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'create' && styles.radioSelected,
                ]}
              >
                {mode === 'create' && <View style={styles.radioDot} />}
              </View>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              style={({ pressed }) => [
                styles.option,
                mode === 'join' && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  mode === 'join' && styles.optionIconSelected,
                ]}
              >
                <Ionicons
                  name="link-outline"
                  size={22}
                  color={mode === 'join' ? '#FFFFFF' : '#C87591'}
                />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Enter a partner code</Text>
                <Text style={styles.optionDescription}>
                  Use the invite code your partner sent you.
                </Text>
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'join' && styles.radioSelected,
                ]}
              >
                {mode === 'join' && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          </View>

          {mode === 'join' && (
            <View style={styles.codeSection}>
              <Text style={styles.inputLabel}>Partner invite code</Text>

              <TextInput
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="e.g. A7K9P2"
                placeholderTextColor="#B8AEB3"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={styles.codeInput}
              />
            </View>
          )}
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={handleContinue}
            disabled={mode === 'join' && !code.trim()}
            style={({ pressed }) => [
              styles.continueButton,
              mode === 'join' && !code.trim() && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.continueText}>
              {mode === 'create' ? 'Create Invite Code' : 'Connect'}
            </Text>

            <Ionicons
              name="arrow-forward"
              size={19}
              color="#FFFFFF"
            />
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
  },

  top: {
    paddingTop: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8E6877',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  content: {
    flex: 1,
    paddingTop: 36,
  },

  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#F9E7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '700',
    color: '#30272C',
    letterSpacing: -0.6,
  },

  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: '#81757B',
    maxWidth: 350,
  },

  options: {
    marginTop: 30,
    gap: 14,
  },

  option: {
    minHeight: 92,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E5E9',
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionSelected: {
    borderColor: '#D99AAD',
    backgroundColor: '#FFF6F8',
  },

  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FBECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionIconSelected: {
    backgroundColor: '#C87591',
  },

  optionTextContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#342C31',
  },

  optionDescription: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#8A7E84',
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D5C8CD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: '#C87591',
  },

  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#C87591',
  },

  codeSection: {
    marginTop: 22,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5056',
    marginBottom: 8,
  },

  codeInput: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DDE1',
    paddingHorizontal: 17,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#342C31',
  },

  bottom: {
    paddingBottom: Platform.OS === 'ios' ? 12 : 22,
    paddingTop: 12,
  },

  continueButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#C87591',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#C87591',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },

  pressed: {
    opacity: 0.75,
  },
});