// ============================================================
// BETWEEN US — ACCOUNT DATA LAYER
// src/lib/account.ts
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// ============================================================
// TYPES
// ============================================================

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

// ============================================================
// ROLE HELPERS
// ============================================================

function normalizeRole(
  value: unknown
): AccountRole | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const role = value.trim().toLowerCase();

  if (role === 'girlfriend') {
    return 'girlfriend';
  }

  if (role === 'boyfriend') {
    return 'boyfriend';
  }

  return undefined;
}

// ============================================================
// CURRENT MEMBER
// ============================================================

function resolveCurrentMember(
  state: AccountState,
  accountUserId: string
): CoupleMember | null {
  const members = Array.isArray(state.members)
    ? state.members
    : [];

  const currentMember = members.find(
    (member) =>
      member?.user_id === accountUserId
  );

  return currentMember || null;
}

// ============================================================
// NORMALIZE ACCOUNT STATE
// ============================================================

function normalizeAccountState(
  state: AccountState,
  sessionUserId: string
): AccountState {
  /*
   * get_my_couple() should return the actual
   * Between Us account user ID.
   *
   * If it does not, use the authenticated
   * Supabase user ID as the fallback.
   */
  const accountUserId =
    typeof state.user_id === 'string' &&
    state.user_id.trim().length > 0
      ? state.user_id
      : sessionUserId;

  const currentMember =
    resolveCurrentMember(
      state,
      accountUserId
    );

  const memberRole =
    normalizeRole(
      currentMember?.role
    );

  const stateRole =
    normalizeRole(
      state.role
    );

  const resolvedRole =
    memberRole ||
    stateRole;

  return {
    ...state,

    user_id:
      accountUserId,

    role:
      resolvedRole,

    name:
      currentMember?.name ||
      state.name,

    avatar_url:
      currentMember?.avatar_url ??
      state.avatar_url,

    members:
      Array.isArray(state.members)
        ? state.members
        : [],
  };
}

// ============================================================
// ENSURE ANONYMOUS SESSION
// ============================================================

export async function ensureAnonymousSession() {
  const {
    data: { session },
  } =
    await supabase.auth.getSession();

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
  } =
    await supabase.auth.signInAnonymously();

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

// ============================================================
// ENSURE DEVICE → ACCOUNT SESSION MAPPING
// ============================================================

async function ensureAccountSessionMapping(
  accountUserId: string,
  sessionUserId: string
) {
  /*
   * Only attempt the mapping when the account is
   * actually represented by this authenticated user.
   *
   * This avoids accidentally binding a device to
   * somebody else's account.
   */
  if (
    !accountUserId ||
    !sessionUserId ||
    accountUserId !== sessionUserId
  ) {
    console.log(
      'BETWEEN US SESSION MAP: Mapping skipped because account ID and device ID differ.'
    );

    return null;
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'ensure_account_session',
      {
        p_account_user_id:
          accountUserId,
      }
    );

  if (error) {
    console.error(
      'BETWEEN US SESSION MAP ERROR:',
      error
    );

    /*
     * Do not destroy the current account flow
     * if the mapping RPC is unavailable.
     */
    return null;
  }

  console.log(
    'BETWEEN US SESSION MAP SUCCESS:',
    data
  );

  return data;
}

// ============================================================
// GET CURRENT ACCOUNT STATE
// ============================================================

export async function getAccountState(): Promise<AccountState> {
  const {
    data: { session },
  } =
    await supabase.auth.getSession();

  if (!session) {
    console.log(
      'BETWEEN US ACCOUNT STATE: No active session.'
    );

    return {
      status: 'new',
    };
  }

  /*
   * This is the anonymous Supabase/device ID.
   */
  const sessionUserId =
    session.user.id;

  console.log(
    'BETWEEN US ACCOUNT STATE: Checking account for auth user:',
    sessionUserId
  );

  // ==========================================================
  // GET ACCOUNT FROM DATABASE
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_my_couple'
    );

  if (error) {
    console.error(
      'BETWEEN US GET ACCOUNT ERROR:',
      error
    );

    throw error;
  }

  const rawState =
    (data || {
      status: 'new',
    }) as AccountState;

  // ==========================================================
  // NORMALIZE
  // ==========================================================

  const state =
    normalizeAccountState(
      rawState,
      sessionUserId
    );

  // ==========================================================
  // ENSURE SESSION MAPPING
  // ==========================================================

  if (
    state.user_id &&
    state.user_id === sessionUserId
  ) {
    await ensureAccountSessionMapping(
      state.user_id,
      sessionUserId
    );
  }

  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    '================================================'
  );

  console.log(
    'BETWEEN US ACCOUNT STATE:'
  );

  console.log(
    'SUPABASE AUTH / DEVICE USER ID:',
    sessionUserId
  );

  console.log(
    'DATABASE ACCOUNT USER ID:',
    rawState.user_id
  );

  console.log(
    'FINAL ACCOUNT USER ID:',
    state.user_id
  );

  console.log(
    'TOP LEVEL ROLE:',
    rawState.role
  );

  console.log(
    'RESOLVED ROLE:',
    state.role
  );

  console.log(
    'ACCOUNT NAME:',
    state.name
  );

  console.log(
    'COUPLE ID:',
    state.couple_id
  );

  console.log(
    'STATUS:',
    state.status
  );

  console.log(
    'MEMBERS:',
    JSON.stringify(
      state.members,
      null,
      2
    )
  );

  console.log(
    'FINAL ACCOUNT STATE:',
    JSON.stringify(
      state,
      null,
      2
    )
  );

  console.log(
    '================================================'
  );

  // ==========================================================
  // CACHE LOCALLY
  // ==========================================================

  await saveAccountState(
    state
  );

  return state;
}

// ============================================================
// SAVE ACCOUNT STATE
// ============================================================

export async function saveAccountState(
  state: AccountState
) {
  await AsyncStorage.setItem(
    LOCAL_ACCOUNT_KEY,
    JSON.stringify(state)
  );
}

// ============================================================
// GET CACHED ACCOUNT STATE
// ============================================================

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

// ============================================================
// CLEAR CACHED ACCOUNT STATE
// ============================================================

export async function clearCachedAccountState() {
  await AsyncStorage.removeItem(
    LOCAL_ACCOUNT_KEY
  );
}