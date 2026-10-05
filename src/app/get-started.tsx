import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, shadow, spacing } from '../lib/theme';
import { BackButton, FadeIn, Heading, PressScale, Screen } from '../lib/ui';

const ROLES = [
  { key: 'girlfriend', label: 'Girlfriend' },
  { key: 'boyfriend', label: 'Boyfriend' },
] as const;

export default function GetStartedScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <BackButton onPress={() => router.replace('/')} />

        <FadeIn style={styles.content}>
          <Heading
            eyebrow="Let's begin"
            title="Who are you?"
            subtitle="Choose the role you'll use inside Between Us."
          />

          <View style={styles.options}>
            {ROLES.map((role) => (
              <PressScale
                key={role.key}
                style={styles.roleCard}
                contentStyle={styles.roleContent}
                onPress={() =>
                  router.push({
                    pathname: '/role',
                    params: { role: role.key },
                  })
                }
              >
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={22} color={colors.blue} />
                </View>

                <View style={styles.roleInfo}>
                  <Text style={styles.roleTitle}>{role.label}</Text>
                  <Text style={styles.roleDescription}>
                    Your identity inside Between Us.
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textFaint}
                />
              </PressScale>
            ))}
          </View>
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxxl,
  },

  options: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },

  roleCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },

  roleContent: {
    minHeight: 96,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },

  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  roleDescription: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },
});