import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPending, listPayments, queuePayment, readCollectionPack, saveCollectionPack, syncPayments, type CollectionPack, type QueuedPayment } from '@/lib/offline-payments';

import { saveOfflineAccess, clearOfflineAccess } from '@/lib/offline-cache';

const auth = vi.hoisted(() => ({ user: 'user-a', expiry: Math.floor(Date.now() / 1000) + 3600 }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: auth.user }, expires_at: auth.expiry } } }), getUser: async () => ({ data: { user: { id: auth.user } } }) }, rpc: vi.fn(async () => ({ error: new Error('Connection interrupted') })) } }));

const pack = (schoolId: string): CollectionPack => ({ key: `user-a:${schoolId}`, userId: 'user-a', schoolId, expiresAt: Date.now() + 3600000, students: [{ id: 'student-a', status: 'active' }] as CollectionPack['students'], fees: [{ id: 'tuition' }] as CollectionPack['fees'], balances: [] });
const payment = (schoolId: string): QueuedPayment => ({ id: crypto.randomUUID(), userId: 'user-a', schoolId, studentId: 'student-a', status: 'pending', items: [{ fee_type_id: 'tuition', amount: 5 }], receipt: { receipt_number: 'OFF-TEST', pending: true, paid_on: '2026-11-16', year: 2026, term: 3, method: 'Cash (USD)', reference: '', notes: '', total: 5, received_by_name: 'Bursar', voided: false, student: { first_name: 'Tawana', last_name: 'Andrigu', reg_number: 'TEST', grade: 'Grade 1' }, items: [{ name: 'Tuition', amount: 5, balance: 35 }] } });

beforeEach(async () => { await clearOfflineAccess('user-a'); auth.user = 'user-a'; auth.expiry = Math.floor(Date.now() / 1000) + 3600; });
describe('offline cash collection rules', () => {
  it('accepts a $5 partial cash payment and keeps it isolated to its school and user', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack(pack(school)); const p = payment(school); await queuePayment(p);
    expect((await listPayments('user-a', school))[0]?.receipt.total).toBe(5);
    expect(await listPayments('user-b', school)).toEqual([]);
    expect(await listPayments('user-a', 'different-school')).toEqual([]);
  });
  it('does not overwrite or duplicate an immutable receipt reference', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack(pack(school)); const p = payment(school); await queuePayment(p);
    await expect(queuePayment(p)).rejects.toThrow(); expect(await listPayments('user-a', school)).toHaveLength(1);
  });
  it('refuses non-cash payments offline', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack(pack(school)); const p = payment(school); p.receipt.method = 'EcoCash';
    await expect(queuePayment(p)).rejects.toThrow('Choose cash');
  });
  it('accepts cash after token expiry within verified seven-day offline access', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack(pack(school)); auth.expiry = 1;
    await queuePayment(payment(school));
    expect(await listPayments('user-a', school)).toHaveLength(1);
  });
  it('refuses expired collection records', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack({ ...pack(school), expiresAt: 1 });
    expect(await readCollectionPack('user-a', school)).toBeNull(); await expect(queuePayment(payment(school))).rejects.toThrow('Reconnect');
  });
  it('preserves a pending receipt when synchronization fails', async () => {
    const school = crypto.randomUUID(); await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'bursar', status: 'active', full_name: null, schools: { id: school } } as any]); await saveCollectionPack(pack(school)); await queuePayment(payment(school));
    await expect(syncPayments('user-a', school)).rejects.toThrow('Connection interrupted');
    expect((await listPayments('user-a', school))[0]?.status).toBe('pending');
  });
  it('subtracts $5 from $40 only for the selected student', () => {
    const balances = [{ student_id: 'student-a', fee_type_id: 'tuition', paid: 0, balance: 40 }, { student_id: 'student-b', fee_type_id: 'tuition', paid: 0, balance: 40 }] as CollectionPack['balances'];
    expect(applyPending(balances, [payment('school')], 'student-a')[0]?.balance).toBe(35);
    expect(applyPending(balances, [payment('school')], 'student-b')[0]?.balance).toBe(40);
  });
});
it('denies offline collection to the read-only Headmaster', async () => {
  const school = crypto.randomUUID();
  await saveOfflineAccess({ id: 'user-a' }, [{ school_id: school, role: 'headmaster', status: 'active', full_name: null, schools: { id: school } } as any]);
  await saveCollectionPack(pack(school));
  await expect(queuePayment(payment(school))).rejects.toThrow('Sign in again');
});
