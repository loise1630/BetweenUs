import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleScreen() {
  const params =
    useLocalSearchParams<{
      role?: string;
    }>();

  const role =
    params.role === 'girlfriend'
      ? 'girlfriend'
      : params.role === 'boyfriend'
        ? 'boyfriend'
        : null;

  if (!role) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>

          <Text style={styles.errorTitle}>
            Choose your role first
          </Text>

          <Pressable
            style={styles.button}
            onPress={() =>
              router.replace('/get-started')
            }
          >
            <Text style={styles.buttonText}>
              Choose Role
            </Text>
          </Pressable>

        </View>
      </SafeAreaView>
    );
  }

  const roleName =
    role === 'boyfriend'
      ? 'Boyfriend'
      : 'Girlfriend';

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
            YOUR ROLE
          </Text>

          <Text style={styles.title}>
            You're the
          </Text>

          <Text style={styles.role}>
            {roleName}
          </Text>

          <Text style={styles.description}>
            This will be your identity inside
            Between Us.
          </Text>

        </View>

        <Pressable
          style={styles.button}
          onPress={() =>
            router.push({
              pathname: '/name',
              params: {
                role,
              },
            })
          }
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
    fontSize: 34,
    fontWeight: '600',
    color: '#30292D',
  },

  role: {
    marginTop: 2,
    fontSize: 42,
    fontWeight: '800',
    color: '#9E6377',
  },

  description: {
    marginTop: 16,
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 21,
    color: '#8E8189',
  },

  button: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#9E6377',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  errorContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  errorTitle: {
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '700',
    color: '#30292D',
    marginBottom: 20,
  },
});