import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

export type AccountStatus =
  | 'new'
  | 'waiting'
  | 'paired';

export type AccountRole =
  | 'girlfriend'
  | 'boyfriend';

export type CoupleMember = {
  user_id: string;
  role: AccountRole;
  name: string;
  avatar_url?: string | null;
};

export type AccountState = {
  status: AccountStatus;
  user_id?: string;
  couple_id?: string | null;
  role?: AccountRole;
  name?: string;
  avatar_url?: string | null;
  pairing_code?: string | null;
  login_code?: string | null;
  members?: CoupleMember[];
};

const LOCAL_ACCOUNT_KEY =
  '@between_us_account';

export async function ensureAnonymousSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    console.log(
      'BETWEEN US AUTH SESSION:',
      session.user.id
    );

    return session;
  }

  console.log(
    'BETWEEN US AUTH: Creating anonymous session...'
  );

  const {
    data,
    error,
  } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error(
      'BETWEEN US AUTH ERROR:',
      error
    );

    throw error;
  }

  if (!data.session) {
    throw new Error(
      'Unable to create a secure app session.'
    );
  }

  console.log(
    'BETWEEN US AUTH: Anonymous session created:',
    data.session.user.id
  );

  return data.session;
}

export async function getAccountState(): Promise<AccountState> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.log(
      'BETWEEN US ACCOUNT STATE: No active session.'
    );

    return {
      status: 'new',
    };
  }

  console.log(
    'BETWEEN US ACCOUNT STATE: Checking account for user:',
    session.user.id
  );

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_couple'
  );

  if (error) {
    console.error(
      'BETWEEN US GET ACCOUNT ERROR:',
      error
    );

    throw error;
  }

  const state =
    (data || {
      status: 'new',
    }) as AccountState;

  console.log(
    '================================================'
  );

  console.log(
    'BETWEEN US ACCOUNT STATE:'
  );

  console.log(
    JSON.stringify(
      state,
      null,
      2
    )
  );

  console.log(
    '================================================'
  );

  await saveAccountState(state);

  return state;
}

export async function saveAccountState(
  state: AccountState
) {
  await AsyncStorage.setItem(
    LOCAL_ACCOUNT_KEY,
    JSON.stringify(state)
  );
}

export async function getCachedAccountState(): Promise<AccountState | null> {
  const raw =
    await AsyncStorage.getItem(
      LOCAL_ACCOUNT_KEY
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(
      raw
    ) as AccountState;
  } catch {
    return null;
  }
}

export async function clearCachedAccountState() {
  await AsyncStorage.removeItem(
    LOCAL_ACCOUNT_KEY
  );
}