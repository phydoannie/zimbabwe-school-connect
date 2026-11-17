import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { eligibleQuery, restoreOfflineViews, saveOfflineViews, OFFLINE_MAX_AGE, saveOfflineAccess, readOfflineAccess, clearOfflineAccess } from '@/lib/offline-cache';
import { refuseServiceWorker } from '@/lib/pwa-policy';

describe('offline school safety', () => {
  it('keeps schools and users isolated', () => {
    expect(eligibleQuery(['students', 'school-b'], 'user-a', ['school-a'])).toBe(false);
    expect(eligibleQuery(['students', 'school-a'], 'user-a', ['school-a'])).toBe(true);
    expect(eligibleQuery(['memberships', 'user-b'], 'user-a', ['school-a'])).toBe(false);
  });
  it('restores saved views only to the same user before access expires', async () => {
    const client = new QueryClient();
    await saveOfflineAccess({ id: "user-a" }, [{ school_id: "school-a", status: "active", role: "bursar", full_name: null, schools: { id: "school-a" } } as any]);
    client.setQueryData(['memberships', 'user-a'], [{ school_id: 'school-a', status: 'active' }]);
    client.setQueryData(['students', 'school-a'], [{ id: 'student-1' }]);
    client.setQueryData(['students', 'school-b'], [{ id: 'student-2' }]);
    await saveOfflineViews(client, 'user-a', Math.floor(Date.now() / 1000) + 3600);
    const restored = new QueryClient();
    expect(await restoreOfflineViews(restored, 'user-b')).toBeNull();
    expect(await restoreOfflineViews(restored, 'user-a')).not.toBeNull();
    expect(restored.getQueryData(['students', 'school-a'])).toEqual([{ id: 'student-1' }]);
    expect(restored.getQueryData(['students', 'school-b'])).toBeUndefined();
    expect(await restoreOfflineViews(new QueryClient(), 'user-a', Date.now() + OFFLINE_MAX_AGE)).toBeNull();
  });
});
describe('PWA preview safety', () => {
  it.each(['id-preview--abc.lovable.app', 'preview-v2--abc.gpt-eng.com', 'project--abc-dev.lovable.app', 'abc.lovableproject.com', 'beta.lovable.dev'])('refuses registration on %s', (host) => {
    expect(refuseServiceWorker(host, true, false, false)).toBe(true);
  });
  it('allows the published domain but refuses dev, framed and kill-switch contexts', () => {
    expect(refuseServiceWorker('www.schoolsys.co.zw', true, false, false)).toBe(false);
    expect(refuseServiceWorker('preview-v2--shop.example.com', true, false, false)).toBe(false);
    expect(refuseServiceWorker('www.schoolsys.co.zw', false, false, false)).toBe(true);
    expect(refuseServiceWorker('www.schoolsys.co.zw', true, true, false)).toBe(true);
    expect(refuseServiceWorker('www.schoolsys.co.zw', true, false, true)).toBe(true);
  });
});

describe('seven-day offline access', () => {
  it('survives token expiry and app reopening for seven days, not beyond', async () => {
    const now = Date.now();
    await saveOfflineAccess({ id: 'weekly-user' }, [{ school_id: 'weekly-school', status: 'active', role: 'bursar', full_name: null, schools: { id: 'weekly-school' } } as any], now);
    expect((await readOfflineAccess('weekly-user', now + 6 * 86400000))?.userId).toBe('weekly-user');
    expect(await readOfflineAccess('weekly-user', now + 7 * 86400000)).toBeNull();
    expect(await readOfflineAccess('weekly-user', now - 1)).toBeNull();
  });
  it('explicit sign-out removes offline access without revealing another user', async () => {
    await saveOfflineAccess({ id: 'logout-user' }, [{ school_id: 'school-a', status: 'active', role: 'bursar', full_name: null, schools: { id: 'school-a' } } as any]);
    await clearOfflineAccess('logout-user');
    expect(await readOfflineAccess('logout-user')).toBeNull();
    expect(await readOfflineAccess('unknown-user')).toBeNull();
  });
});
