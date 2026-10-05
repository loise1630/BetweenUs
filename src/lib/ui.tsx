import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, radius, shadow, spacing, type } from './theme';

/* ------------------------------------------------------------------ */
/* SCREEN: pastel background + soft organic shapes                     */
/* ------------------------------------------------------------------ */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={[styles.blob, styles.blobA]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobB]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobC]} />
      <SafeAreaView style={styles.flex}>{children}</SafeAreaView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ANIMATION                                                           */
/* ------------------------------------------------------------------ */

export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function PressScale({
  children,
  onPress,
  disabled,
  scaleTo = 0.97,
  style,
  contentStyle,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <View style={contentStyle}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* CARD                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* ICON BUTTON / BACK BUTTON                                           */
/* ------------------------------------------------------------------ */

export function IconButton({
  name,
  onPress,
  disabled,
  size = 44,
  iconSize = 20,
  color = colors.text,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
  color?: string;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.92}
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        ...shadow.soft,
      }}
      contentStyle={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={iconSize} color={color} />
    </PressScale>
  );
}

export function BackButton({
  onPress,
  disabled,
}: {
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.backRow}>
      <IconButton
        name="chevron-back"
        onPress={onPress}
        disabled={disabled}
        iconSize={20}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* HEADING                                                             */
/* ------------------------------------------------------------------ */

export function Heading({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <View style={center && { alignItems: 'center' }}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, center && { textAlign: 'center' }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={[styles.title, center && { textAlign: 'center' }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, center && { textAlign: 'center' }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* INPUT                                                               */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SEGMENTED                                                           */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T | null;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <PressScale
            key={option.key}
            onPress={() => onChange(option.key)}
            scaleTo={0.97}
            style={[styles.segment, active && styles.segmentActive]}
            contentStyle={styles.segmentContent}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* PRIMARY BUTTON                                                      */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon = 'arrow-forward',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap | null;
}) {
  return (
    <PressScale
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}
      contentStyle={styles.buttonContent}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Text style={styles.buttonText}>{label}</Text>
          {icon ? <Ionicons name={icon} size={18} color={colors.white} /> : null}
        </>
      )}
    </PressScale>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },

  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobA: {
    width: 340,
    height: 340,
    top: -120,
    right: -110,
    backgroundColor: colors.backgroundLight,
    opacity: 0.75,
  },
  blobB: {
    width: 280,
    height: 280,
    top: 330,
    left: -140,
    backgroundColor: colors.backgroundDeep,
    opacity: 0.55,
  },
  blobC: {
    width: 320,
    height: 320,
    bottom: -140,
    right: -90,
    backgroundColor: '#F0DFE7',
    opacity: 0.7,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },

  backRow: {
    alignItems: 'flex-start',
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
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },

  fieldLabel: {
    ...type.label,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  input: {
    height: layout.touch,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.blue,
    backgroundColor: colors.surface,
  },

  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  segmentContent: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.blue,
    fontWeight: '600',
  },

  button: {
    height: layout.touch + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.soft,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
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
    fontSize: 15,
    fontWeight: '600',
  },
});