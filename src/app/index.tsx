import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.logo}>
          <Text style={styles.logoHeart}>
            ♡
          </Text>
        </View>

        <View style={styles.content}>

          <Text style={styles.brand}>
            BETWEEN US
          </Text>

          <Text style={styles.title}>
            For everything you don't
            always know how to say.
          </Text>

          <Text style={styles.subtitle}>
            A private space for two people
            to stay connected.
          </Text>

        </View>

        <View style={styles.actions}>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              router.push('/get-started');
            }}
          >
            <Text style={styles.primaryText}>
              Get Started
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              router.push('/join');
            }}
          >
            <Text style={styles.secondaryText}>
              Join with a Pairing Code
            </Text>
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
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 28,
  },

  logo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F3DCE4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoHeart: {
    fontSize: 31,
    color: '#9E6377',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  brand: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#B47789',
    marginBottom: 13,
  },

  title: {
    maxWidth: 330,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: '#30292D',
  },

  subtitle: {
    marginTop: 17,
    maxWidth: 290,
    fontSize: 14,
    lineHeight: 21,
    color: '#8E8189',
  },

  actions: {
    gap: 11,
  },

  primaryButton: {
    height: 55,
    borderRadius: 17,
    backgroundColor: '#9E6377',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  secondaryButton: {
    height: 52,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADCE2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryText: {
    color: '#775565',
    fontSize: 13,
    fontWeight: '700',
  },
});