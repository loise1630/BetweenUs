import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getAccountState } from '../lib/account';
import {
  getRelationshipNotifications,
  subscribeRelationshipNotifications,
} from '../lib/relationshipData';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let unsubscribe: (() => void) | undefined;

      const refresh = async () => {
        try {
          const [account, notifications] = await Promise.all([
            getAccountState(),
            getRelationshipNotifications(),
          ]);
          const partnerId = account.members?.find((member) => member.user_id !== account.user_id)?.user_id;
          if (active) {
            setCount(notifications.filter((item) => !!partnerId && item.actor_id === partnerId && !item.read_at).length);
          }
        } catch (error) {
          console.warn('Could not refresh unread notification count:', error);
        }
      };

      void refresh();
      void subscribeRelationshipNotifications(() => {
        if (active) void refresh();
      })
        .then((stop) => {
          if (active) unsubscribe = stop;
          else stop();
        })
        .catch((error) => {
          console.warn('Notification subscription unavailable:', error);
        });

      const timer = setInterval(() => {
        if (active) void refresh();
      }, 30000);

      return () => {
        active = false;
        unsubscribe?.();
        clearInterval(timer);
      };
    }, [])
  );

  return count;
}
