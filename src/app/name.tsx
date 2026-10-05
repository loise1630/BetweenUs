import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { layout, spacing } from '../lib/theme';
import {
  BackButton,
  Card,
  FadeIn,
  Field,
  Heading,
  PrimaryButton,
  Screen,
} from '../lib/ui';

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

  const canContinue = name.trim().length > 0 && role !== null;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BackButton onPress={() => router.back()} />

        <FadeIn style={styles.content}>
          <Heading
            eyebrow="Nice to meet you"
            title="What should we call you?"
            subtitle="Choose the name your partner will see inside Between Us."
          />

          <Card style={styles.card}>
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </Card>
        </FadeIn>

        <View>
          <PrimaryButton
            label="Continue"
            disabled={!canContinue}
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
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxxl,
  },

  card: {
    marginTop: spacing.xxl,
  },
});