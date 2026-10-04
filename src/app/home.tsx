import { useLocalSearchParams } from 'expo-router';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    name?: string;
    code?: string;
  }>();

  const role =
    params.role === 'girlfriend'
      ? 'girlfriend'
      : 'boyfriend';

  const name =
    typeof params.name === 'string'
      ? params.name
      : 'You';

  const code =
    typeof params.code === 'string'
      ? params.code
      : '------';

  const isBoyfriend = role === 'boyfriend';
  const isGirlfriend = role === 'girlfriend';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <Text style={styles.brand}>
          BETWEEN US
        </Text>

        <Text style={styles.title}>
          Who's using?
        </Text>

        <Text style={styles.subtitle}>
          This is your identity inside Between Us.
        </Text>

        <View style={styles.peopleRow}>

          <View
            style={[
              styles.personCard,
              isBoyfriend && styles.selectedCard,
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {isBoyfriend
                  ? name.charAt(0).toUpperCase()
                  : '?'}
              </Text>
            </View>

            <Text style={styles.roleText}>
              Boyfriend
            </Text>

            {isBoyfriend && (
              <Text style={styles.name}>
                {name}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.personCard,
              isGirlfriend && styles.selectedCard,
            ]}
          >
            <View
              style={[
                styles.avatar,
                styles.girlfriendAvatar,
              ]}
            >
              <Text style={styles.avatarText}>
                {isGirlfriend
                  ? name.charAt(0).toUpperCase()
                  : '?'}
              </Text>
            </View>

            <Text style={styles.roleText}>
              Girlfriend
            </Text>

            {isGirlfriend && (
              <Text style={styles.name}>
                {name}
              </Text>
            )}
          </View>

        </View>

        <View style={styles.waitingCard}>

          <View style={styles.waitingIcon}>
            <Text style={styles.waitingHeart}>
              ♡
            </Text>
          </View>

          <Text style={styles.waitingTitle}>
            Waiting for your partner
          </Text>

          <Text style={styles.waitingText}>
            Your shared space will become available
            when your partner joins.
          </Text>

          <Text style={styles.codeLabel}>
            PAIRING CODE
          </Text>

          <Text style={styles.code}>
            {code}
          </Text>

          <Pressable
            style={styles.shareButton}
            onPress={() => {}}
          >
            <Text style={styles.shareButtonText}>
              Share pairing code
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
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  brand: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#B47789',
    marginBottom: 7,
  },

  title: {
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: '#2E282C',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#918188',
  },

  peopleRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 27,
  },

  personCard: {
    flex: 1,
    minHeight: 145,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedCard: {
    backgroundColor: '#FDF1F5',
    borderColor: '#E6C2CE',
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFD5DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  girlfriendAvatar: {
    backgroundColor: '#E7DFED',
  },

  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#805466',
  },

  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A07E89',
  },

  name: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
    color: '#342C31',
  },

  waitingCard: {
    marginTop: 18,
    borderRadius: 25,
    backgroundColor: '#F8F0F8',
    borderWidth: 1,
    borderColor: '#EDE0EF',
    padding: 22,
    alignItems: 'center',
  },

  waitingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  waitingHeart: {
    fontSize: 27,
    color: '#B06D83',
  },

  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#362E33',
  },

  waitingText: {
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#8E8189',
  },

  codeLabel: {
    marginTop: 22,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: '#AD899D',
  },

  code: {
    marginTop: 5,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 5,
    color: '#714C63',
  },

  shareButton: {
    marginTop: 16,
    width: '100%',
    height: 45,
    borderRadius: 14,
    backgroundColor: '#9E6377',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});