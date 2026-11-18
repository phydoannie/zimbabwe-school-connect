import Dexie, { type Table } from 'dexie';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { OFFLINE_ACCESS_MS, offlineAccessValid } from './offline-policy';
import type { User } from '@supabase/supabase-js';
import type { Membership } from './school-context';
import { subscriptionAllowsAccess } from './subscriptions';

type Snapshot = { userId: string; savedAt: number; expiresAt: number; state: DehydratedState };
type Access = { userId: string; user: Pick<User, 'id' | 'email'>; memberships: Membership[]; verifiedAt: number; expiresAt: number };
class OfflineDatabase extends Dexie {
  declare snapshots: Table<Snapshot, string>;
  declare access: Table<Access, string>;
  constructor() {
    super('schoolsys-offline-v1');
    this.version(1).stores({ snapshots: 'userId, savedAt' });
    this.version(2).stores({ snapshots: 'userId, savedAt', access: 'userId' });
  }
}
// Lazy initialization keeps IndexedDB outside the server import path.
let database: OfflineDatabase | undefined;
function db() { return database ??= new OfflineDatabase(); }
export const OFFLINE_MAX_AGE = OFFLINE_ACCESS_MS;
const LAST_USER = 'schoolsys.offlineUser';
export async function saveOfflineAccess(user: Pick<User, 'id' | 'email'>, memberships: Membership[], now = Date.now()) {
  const active = memberships.filter((m) => m.status === 'active' && m.schools && subscriptionAllowsAccess(m.subscription, now));
  if (!active.length) throw new Error('No active school access');
  const access: Access = { userId: user.id, user: { id: user.id, ...(user.email !== undefined ? { email: user.email } : {}) }, memberships: active, verifiedAt: now, expiresAt: now + OFFLINE_ACCESS_MS };
  await db().access.put(access);
  if (typeof window !== 'undefined') localStorage.setItem(LAST_USER, user.id);
  return access;
}
export async function readOfflineAccess(userId?: string, now = Date.now()) {
  const id = userId ?? (typeof window !== 'undefined' ? localStorage.getItem(LAST_USER) : null);
  if (!id) return null;
  const access = await db().access.get(id);
  return access && offlineAccessValid(access.verifiedAt, access.expiresAt, now) ? access : null;
}
export async function clearOfflineAccess(userId: string) {
  await db().transaction('rw', db().access, db().snapshots, async () => {
    await db().access.delete(userId); await db().snapshots.delete(userId);
  });
  if (typeof window !== 'undefined' && localStorage.getItem(LAST_USER) === userId) localStorage.removeItem(LAST_USER);
}

export function eligibleQuery(key: readonly unknown[], userId: string, schoolIds: string[]) {
  return key[0] === 'memberships' ? key[1] === userId : schoolIds.some((id) => key.includes(id));
}

export async function saveOfflineViews(client: QueryClient, userId: string, _sessionExpiry?: number) {
  const access = await readOfflineAccess(userId);
  if (!access) return;
  const memberships = client.getQueryData<{ school_id: string; status: string }[]>(['memberships', userId]);
  if (!memberships) return;
  const schoolIds = memberships.filter((m) => m.status === 'active').map((m) => m.school_id);
  const savedAt = Date.now();
  const state = dehydrate(client, { shouldDehydrateMutation: () => false, shouldDehydrateQuery: (query) => query.state.status === 'success' && eligibleQuery(query.queryKey, userId, schoolIds) });
  await db().snapshots.put({ userId, savedAt, expiresAt: access.expiresAt, state });
  return savedAt;
}

export async function restoreOfflineViews(client: QueryClient, userId: string, now = Date.now()) {
  const access = await readOfflineAccess(userId, now);
  if (!access) return null;
  client.setQueryData(['memberships', userId], access.memberships);
  const snapshot = await db().snapshots.get(userId);
  if (snapshot && snapshot.expiresAt > now) hydrate(client, snapshot.state);
  return snapshot?.savedAt ?? access.verifiedAt;
}