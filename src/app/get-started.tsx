import { router } from 'expo-router';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GetStartedScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.content}>

          <Text style={styles.eyebrow}>
            LET'S BEGIN
          </Text>

          <Text style={styles.title}>
            Who are you?
          </Text>

          <Text style={styles.subtitle}>
            Choose the role you'll use inside
            Between Us.
          </Text>

          <View style={styles.options}>

            <Pressable
              style={({ pressed }) => [
                styles.roleCard,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                router.push('/name?role=girlfriend');
              }}
            >
              <View style={styles.girlAvatar}>
                <Text style={styles.avatarText}>
                  G
                </Text>
              </View>

              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>
                  Girlfriend
                </Text>

                <Text style={styles.roleDescription}>
                  Your identity inside Between Us.
                </Text>
              </View>

              <Text style={styles.arrow}>
                ›
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.roleCard,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                router.push('/name?role=boyfriend');
              }}
            >
              <View style={styles.boyAvatar}>
                <Text style={styles.avatarText}>
                  B
                </Text>
              </View>

              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>
                  Boyfriend
                </Text>

                <Text style={styles.roleDescription}>
                  Your identity inside Between Us.
                </Text>
              </View>

              <Text style={styles.arrow}>
                ›
              </Text>
            </Pressable>

          </View>

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
    fontSize: 31,
    fontWeight: '300',
    color: '#604A54',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B47789',
    marginBottom: 10,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#30292D',
  },

  subtitle: {
    marginTop: 9,
    maxWidth: 310,
    fontSize: 14,
    lineHeight: 21,
    color: '#8E8189',
  },

  options: {
    marginTop: 28,
    gap: 13,
  },

  roleCard: {
    minHeight: 94,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E1E6',
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  girlAvatar: {
    width: 51,
    height: 51,
    borderRadius: 26,
    backgroundColor: '#E7DFED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  boyAvatar: {
    width: 51,
    height: 51,
    borderRadius: 26,
    backgroundColor: '#EFD5DE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#805466',
  },

  roleInfo: {
    flex: 1,
    marginLeft: 14,
  },

  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#342C31',
  },

  roleDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#95868E',
  },

  arrow: {
    fontSize: 27,
    fontWeight: '300',
    color: '#B78D9D',
    marginLeft: 8,
  },
});