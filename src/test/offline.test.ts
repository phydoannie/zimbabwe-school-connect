import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { eligibleQuery, restoreOfflineViews, saveOfflineViews, OFFLINE_MAX_AGE } from '@/lib/offline-cache';
import { refuseServiceWorker } from '@/lib/pwa-policy';

describe('offline school safety', () => {
  it('keeps schools and users isolated', () => {
    expect(eligibleQuery(['students', 'school-b'], 'user-a', ['school-a'])).toBe(false);
    expect(eligibleQuery(['students', 'school-a'], 'user-a', ['school-a'])).toBe(true);
    expect(eligibleQuery(['memberships', 'user-b'], 'user-a', ['school-a'])).toBe(false);
  });
  it('restores saved views only to the same user before access expires', async () => {
    const client = new QueryClient();
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