import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queueEntry, listEntries, overlayEntries, syncEntries, type OfflineEntry } from '@/lib/offline-entries';
import { saveCollectionPack, type CollectionPack } from '@/lib/offline-payments';
import { clearOfflineAccess, saveOfflineAccess } from '@/lib/offline-cache';
import type { Membership } from '@/lib/school-context';

const calls = vi.hoisted(() => ({ rpc: vi.fn(), user: 'entry-user' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: calls.user } }, error: null }) }, rpc: calls.rpc } }));
const schoolId = () => crypto.randomUUID();
function fee(id: string, name: string, amount: number): CollectionPack['fees'][number] {
  return { id, name, amount, account: name, applies_to: [], active: true, boarding_only: false, created_at: new Date().toISOString(), description: null, school_id: 'test-school', term: 1, year: 2026 };
}
function pack(school: string): CollectionPack {
  return { key: `entry-user:${school}`, userId: 'entry-user', schoolId: school, expiresAt: Date.now() + 3600000, students: [], balances: [], fees: [fee('tuition', 'Tuition', 100), fee('levy', 'General Levy', 40), fee('exam', 'Exam Fee', 20)], cashData: { entries: [], expenses: [], allocations: [] } };
}
async function setup(school: string, role = 'bursar') {
  const member = { school_id: school, role, status: 'active', full_name: null, schools: { id: school }, subscription: { school_id: school, slug: 'test', status: 'active', subscription_ends_at: new Date(Date.now() + 86400000).toISOString() } } as Membership;
  await saveOfflineAccess({ id: 'entry-user' }, [member]);
  await saveCollectionPack(pack(school));
}
function student(school: string): OfflineEntry {
  return { id: crypto.randomUUID(), userId: 'entry-user', schoolId: school, createdAt: new Date().toISOString(), status: 'pending', kind: 'student', payload: { student: { reg_number: crypto.randomUUID(), first_name: 'Tawana', last_name: 'Andrigu', grade: 'Grade 1', class_name: '', gender: '', boarding: false, guardian_name: '', guardian_phone: '' }, arrears: [{ fee_type_id: 'levy', amount: 200 }, { fee_type_id: 'tuition', amount: 50 }, { fee_type_id: 'exam', amount: 20 }] } };
}
function expense(school: string): OfflineEntry {
  return { id: crypto.randomUUID(), userId: 'entry-user', schoolId: school, createdAt: new Date().toISOString(), status: 'pending', kind: 'expense', payload: { amount: 12.5, description: 'Exercise books', account: 'Tuition', category: 'Stationery', method: 'Cash (USD)', spent_on: '2026-11-22', voucher_reference: 'V-12' } };
}
beforeEach(async () => { await clearOfflineAccess('entry-user'); calls.user = 'entry-user'; calls.rpc.mockReset(); });
describe('offline student and expense entries', () => {
  it('keeps only manually entered debts: 200 levy + 50 tuition + 20 exam = 270', async () => {
    const school = schoolId(); await setup(school); const entry = student(school); await queueEntry(entry);
    const result = overlayEntries(pack(school), await listEntries('entry-user', school));
    expect(result.students[0]?.id).toBe(entry.id);
    expect(result.balances.reduce((sum, b) => sum + b.balance, 0)).toBe(270);
    expect(overlayEntries(result, [entry]).balances.reduce((sum,b) => sum + b.balance, 0)).toBe(270);
  });
  it('zero entered arrears stay zero even when configured tuition is 100', async () => {
    const school = schoolId(); await setup(school); const entry = student(school);
    if (entry.kind !== 'student') throw new Error('Student required');
    entry.payload.arrears = []; await queueEntry(entry);
    expect(overlayEntries(pack(school), [entry]).balances.reduce((sum,b) => sum + b.balance, 0)).toBe(0);
  });
  it('records an expense once and isolates it from other schools and users', async () => {
    const school = schoolId(); await setup(school); const entry = expense(school); await queueEntry(entry);
    const result = overlayEntries(pack(school), [entry]);
    expect(result.cashData?.expenses[0]?.amount).toBe(12.5);
    expect(overlayEntries(result, [entry]).cashData?.entries).toHaveLength(1);
    expect(await listEntries('other-user', school)).toEqual([]);
    expect(await listEntries('entry-user', 'other-school')).toEqual([]);
  });
  it('Headmaster cannot add offline students or expenses', async () => {
    const school = schoolId(); await setup(school, 'headmaster');
    await expect(queueEntry(student(school))).rejects.toThrow();
    await expect(queueEntry(expense(school))).rejects.toThrow();
  });
  it('sign-out revokes offline entry permission', async () => {
    const school = schoolId(); await setup(school); await clearOfflineAccess('entry-user');
    await expect(queueEntry(expense(school))).rejects.toThrow();
  });
  it('never overwrites an immutable offline reference', async () => {
    const school = schoolId(); await setup(school); const entry = expense(school); await queueEntry(entry);
    await expect(queueEntry(entry)).rejects.toThrow();
    expect(await listEntries('entry-user', school)).toHaveLength(1);
  });
  it('retains failed uploads and retries with the same reference', async () => {
    const school = schoolId(); await setup(school); const entry = expense(school); await queueEntry(entry);
    calls.rpc.mockResolvedValueOnce({ error: new Error('Connection interrupted') });
    await expect(syncEntries('entry-user', school)).rejects.toThrow('Connection interrupted');
    expect((await listEntries('entry-user', school))[0]?.status).toBe('pending');
    calls.rpc.mockResolvedValueOnce({ error: null, data: entry.id });
    await syncEntries('entry-user', school); await syncEntries('entry-user', school);
    expect(calls.rpc).toHaveBeenCalledTimes(2);
    expect(calls.rpc.mock.calls[1]?.[1]?._reference).toBe(entry.id);
    expect((await listEntries('entry-user', school))[0]?.status).toBe('synced');
  });
});