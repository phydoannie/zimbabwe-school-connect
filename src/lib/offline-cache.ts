import Dexie, { type Table } from 'dexie';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

type Snapshot = { userId: string; savedAt: number; expiresAt: number; state: DehydratedState };
class OfflineDatabase extends Dexie {
  declare snapshots: Table<Snapshot, string>;
  constructor() {
    super('schoolsys-offline-v1');
    this.version(1).stores({ snapshots: 'userId, savedAt' });
  }
}
// Lazy initialization keeps IndexedDB outside the server import path.
let database: OfflineDatabase | undefined;
function db() { return database ??= new OfflineDatabase(); }
export const OFFLINE_MAX_AGE = 24 * 60 * 60 * 1000;

export function eligibleQuery(key: readonly unknown[], userId: string, schoolIds: string[]) {
  return key[0] === 'memberships' ? key[1] === userId : schoolIds.some((id) => key.includes(id));
}

export async function saveOfflineViews(client: QueryClient, userId: string, sessionExpiry: number) {
  const memberships = client.getQueryData<{ school_id: string; status: string }[]>(['memberships', userId]);
  if (!memberships) return;
  const schoolIds = memberships.filter((m) => m.status === 'active').map((m) => m.school_id);
  const savedAt = Date.now();
  const state = dehydrate(client, { shouldDehydrateMutation: () => false, shouldDehydrateQuery: (query) => query.state.status === 'success' && eligibleQuery(query.queryKey, userId, schoolIds) });
  await db().snapshots.put({ userId, savedAt, expiresAt: Math.min(sessionExpiry * 1000, savedAt + OFFLINE_MAX_AGE), state });
  return savedAt;
}

export async function restoreOfflineViews(client: QueryClient, userId: string, now = Date.now()) {
  const snapshot = await db().snapshots.get(userId);
  if (!snapshot || snapshot.expiresAt <= now) return null;
  hydrate(client, snapshot.state);
  return snapshot.savedAt;
}