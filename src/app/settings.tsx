import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
    clearCachedAccountState,
} from '../lib/account';

import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const [loggingOut, setLoggingOut] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  async function logout() {
    if (loggingOut || deleting) {
      return;
    }

    try {
      setLoggingOut(true);

      await clearCachedAccountState();

      const {
        error,
      } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (error) {
        throw error;
      }

      router.replace('/');
    } catch (error: any) {
      console.error(
        'BETWEEN US LOGOUT ERROR:',
        error
      );

      Alert.alert(
        'Logout failed',
        error?.message ||
          'Something went wrong while logging out.'
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      'Log out?',
      'You will be logged out from this device. Your Between Us account and pairing will remain intact.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  }

  async function deleteAccount() {
    if (loggingOut || deleting) {
      return;
    }

    try {
      setDeleting(true);

      const {
        data,
        error,
      } = await supabase.rpc(
        'delete_my_account'
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          'The account could not be deleted.'
        );
      }

      await clearCachedAccountState();

      await supabase.auth.signOut({
        scope: 'local',
      });

      router.replace('/');
    } catch (error: any) {
      console.error(
        'BETWEEN US DELETE ACCOUNT ERROR:',
        error
      );

      Alert.alert(
        'Delete failed',
        error?.message ||
          'Something went wrong while deleting your account.'
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your Between Us profile, pairing information, login code, and shared couple space. This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your entire Between Us account and shared couple space will be permanently removed.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Yes, delete it',
                  style: 'destructive',
                  onPress: deleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  }

  const busy =
    loggingOut || deleting;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            disabled={busy}
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#604B57"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Settings
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>

        {/* INTRO */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>
            Account
          </Text>

          <Text style={styles.introText}>
            Manage your Between Us account
            and this device.
          </Text>
        </View>

        {/* ACCOUNT SECTION */}
        <Text style={styles.sectionLabel}>
          ACCOUNT
        </Text>

        <View style={styles.card}>

          <Pressable
            onPress={confirmLogout}
            disabled={busy}
            style={({ pressed }) => [
              styles.row,
              pressed &&
                styles.rowPressed,
              busy &&
                styles.disabled,
            ]}
          >
            <View
              style={styles.iconCircle}
            >
              <Ionicons
                name="log-out-outline"
                size={21}
                color="#856172"
              />
            </View>

            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                {loggingOut
                  ? 'Logging out...'
                  : 'Log out'}
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Log out from this device.
                Your account and pairing
                will remain.
              </Text>
            </View>

            {loggingOut ? (
              <ActivityIndicator
                size="small"
                color="#9E6377"
              />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={19}
                color="#C2AAB4"
              />
            )}
          </Pressable>

        </View>

        {/* DANGER SECTION */}
        <Text
          style={[
            styles.sectionLabel,
            styles.dangerSectionLabel,
          ]}
        >
          DANGER ZONE
        </Text>

        <View
          style={styles.dangerCard}
        >
          <View
            style={styles.dangerHeader}
          >
            <View
              style={[
                styles.iconCircle,
                styles.dangerIconCircle,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#A65361"
              />
            </View>

            <View
              style={
                styles.dangerHeaderText
              }
            >
              <Text
                style={styles.dangerTitle}
              >
                Delete account
              </Text>

              <Text
                style={
                  styles.dangerDescription
                }
              >
                Permanently remove your
                account and shared space.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={
              confirmDeleteAccount
            }
            disabled={busy}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed &&
                styles.pressed,
              busy &&
                styles.disabled,
            ]}
          >
            {deleting ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Delete Account
              </Text>
            )}
          </Pressable>
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          Between Us
        </Text>

        <Text style={styles.version}>
          Your private space for two.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9FB',
  },

  scroll: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 22,
    paddingBottom: 45,
  },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: '#30282D',
    fontSize: 19,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 42,
  },

  intro: {
    marginTop: 25,
    marginBottom: 29,
  },

  introTitle: {
    color: '#30282D',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  introText: {
    marginTop: 7,
    color: '#8E7F87',
    fontSize: 13,
    lineHeight: 20,
  },

  sectionLabel: {
    marginBottom: 10,
    color: '#A47788',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0E1E6',
    overflow: 'hidden',
  },

  row: {
    minHeight: 96,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowPressed: {
    backgroundColor: '#FDF6F8',
  },

  iconCircle: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F8EDF2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowContent: {
    flex: 1,
    marginLeft: 13,
    marginRight: 10,
  },

  rowTitle: {
    color: '#342C31',
    fontSize: 15,
    fontWeight: '700',
  },

  rowDescription: {
    marginTop: 4,
    color: '#92828A',
    fontSize: 12,
    lineHeight: 18,
  },

  dangerSectionLabel: {
    marginTop: 30,
    color: '#A65361',
  },

  dangerCard: {
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#FFF3F4',
    borderWidth: 1,
    borderColor: '#F2D5D9',
  },

  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dangerIconCircle: {
    backgroundColor: '#FBE1E4',
  },

  dangerHeaderText: {
    flex: 1,
    marginLeft: 13,
  },

  dangerTitle: {
    color: '#873F4B',
    fontSize: 15,
    fontWeight: '700',
  },

  dangerDescription: {
    marginTop: 4,
    color: '#9C6871',
    fontSize: 12,
    lineHeight: 18,
  },

  deleteButton: {
    height: 46,
    marginTop: 17,
    borderRadius: 14,
    backgroundColor: '#A65361',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  footer: {
    marginTop: 45,
    textAlign: 'center',
    color: '#B18D9D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  version: {
    marginTop: 5,
    textAlign: 'center',
    color: '#B9A9B0',
    fontSize: 10,
  },

  pressed: {
    opacity: 0.72,
  },

  disabled: {
    opacity: 0.5,
  },
});