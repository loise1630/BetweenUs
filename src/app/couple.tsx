import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, layout, radius, shadow, spacing } from '../lib/theme';
import {
  BackButton,
  Card,
  FadeIn,
  Field,
  Heading,
  PressScale,
  PrimaryButton,
  Screen,
} from '../lib/ui';

type Mode = 'create' | 'join';

export default function CoupleScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    name?: string;
  }>();

  const [mode, setMode] = useState<Mode>('create');
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

  const options: {
    key: Mode;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }[] = [
    {
      key: 'create',
      icon: 'add',
      title: 'Create an invite',
      description: 'Generate a code and give it to your partner.',
    },
    {
      key: 'join',
      icon: 'link-outline',
      title: 'Enter a partner code',
      description: 'Use the invite code your partner sent you.',
    },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BackButton onPress={() => router.back()} />

        <FadeIn style={styles.content}>
          <Heading
            eyebrow="Connect"
            title="Connect with your partner"
            subtitle="Create an invite code for your partner, or enter the code they already gave you."
          />

          <View style={styles.options}>
            {options.map((option) => {
              const selected = mode === option.key;

              return (
                <PressScale
                  key={option.key}
                  onPress={() => setMode(option.key)}
                  style={[styles.option, selected && styles.optionSelected]}
                  contentStyle={styles.optionContent}
                >
                  <View
                    style={[styles.optionIcon, selected && styles.optionIconSelected]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={selected ? colors.white : colors.blue}
                    />
                  </View>

                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>

                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </PressScale>
              );
            })}
          </View>

          {mode === 'join' && (
            <Card style={styles.codeSection}>
              <Field
                label="Partner invite code"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="e.g. A7K9P2"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={styles.codeInput}
              />
            </Card>
          )}
        </FadeIn>

        <PrimaryButton
          label={mode === 'create' ? 'Create Invite Code' : 'Connect'}
          onPress={handleContinue}
          disabled={mode === 'join' && !code.trim()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.xl,
  },

  content: {
    flex: 1,
    paddingTop: spacing.xxl,
  },

  options: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },

  option: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow.soft,
  },

  optionSelected: {
    borderColor: colors.blue,
    ...shadow.card,
  },

  optionContent: {
    minHeight: 92,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionIconSelected: {
    backgroundColor: colors.blue,
  },

  optionTextContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  optionDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D9CCD3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: colors.blue,
  },

  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.blue,
  },

  codeSection: {
    marginTop: spacing.xl,
  },

  codeInput: {
    height: 56,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
});