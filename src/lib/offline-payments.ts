import Dexie, { type Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { ReceiptData } from './pdf';
import { readOfflineAccess } from './offline-cache';
import { ROLE_PERMS } from './constants';
import { loadCashEntries } from './finance-data';

type Student = Database['public']['Tables']['students']['Row'];
type Fee = Database['public']['Tables']['fee_types']['Row'];
type Balance = Database['public']['Functions']['debtors_by_fee']['Returns'][number];
export type SavedReceipt = Database['public']['Tables']['payment_receipts']['Row'] & { students: { first_name: string; last_name: string; reg_number: string; grade: string } | null; payment_allocations: { amount: number; fee_types: { name: string } | null }[] };
export type CollectionPack = { key: string; userId: string; schoolId: string; expiresAt: number; savedAt?: number; students: Student[]; fees: Fee[]; balances: Balance[]; arrears?: { student_id: string; fee_type_id: string; amount: number }[]; receipts?: SavedReceipt[]; cashData?: Awaited<ReturnType<typeof loadCashEntries>>; terms?: Database['public']['Tables']['school_terms']['Row'][]; syncedReferences?: string[] };
export type QueuedPayment = { id: string; userId: string; schoolId: string; studentId: string; receipt: ReceiptData; items: { fee_type_id: string; amount: number }[]; status: 'pending' | 'synced'; error?: string; officialNumber?: string };
class CollectionDatabase extends Dexie {
  declare packs: Table<CollectionPack, string>;
  declare payments: Table<QueuedPayment, string>;
  constructor() { super('schoolsys-collections-v1'); this.version(1).stores({ packs: 'key, userId, schoolId', payments: 'id, [userId+schoolId], status' }); }
}
let database: CollectionDatabase | undefined;
function db() { return database ??= new CollectionDatabase(); }
export function collectionChanged() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('collections-changed')); }
export async function readCollectionPack(userId: string, schoolId: string) {
  const access = await readOfflineAccess(userId);
  if (!access?.memberships.some((m) => m.school_id === schoolId)) return null;
  const pack = await db().packs.get(`${userId}:${schoolId}`);
  return pack && pack.expiresAt > Date.now() ? pack : null;
}
export async function listPayments(userId: string, schoolId: string) {
  return db().payments.where('[userId+schoolId]').equals([userId, schoolId]).toArray();
}
export async function saveCollectionPack(pack: CollectionPack) { await db().packs.put(pack); collectionChanged(); }
export async function prepareCollection(userId: string, schoolId: string, _expiresAt?: number) {
  const access = await readOfflineAccess(userId);
  const membership = access?.memberships.find((m) => m.school_id === schoolId);
  if (!access || !membership) throw new Error('Sign in online before saving school records');
  const financial = (ROLE_PERMS[membership.role] ?? []).includes('reports');
  const students: Student[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId).order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    students.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  const feeRows: Fee[] = [];
  for (let page = 0; ; page++) {
    const fees = await supabase.from('fee_types').select('*').eq('school_id', schoolId).order('id').range(page * 1000, page * 1000 + 999);
    if (fees.error) throw fees.error;
    feeRows.push(...(fees.data ?? []));
    if ((fees.data?.length ?? 0) < 1000) break;
  }
  const balances: Balance[] = [];
  for (let page = 0; financial; page++) {
    const result = await supabase.rpc('debtors_by_fee', { _school: schoolId }).order('student_id').order('fee_type_id').range(page * 1000, page * 1000 + 999);
    if (result.error) throw result.error;
    balances.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const arrears: NonNullable<CollectionPack['arrears']> = [];
  for (let page = 0; financial; page++) {
    const result = await supabase.from('student_fee_arrears').select('student_id,fee_type_id,amount').eq('school_id', schoolId).order('id').range(page * 1000, page * 1000 + 999);
    if (result.error) throw result.error;
    arrears.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const receipts = financial ? await supabase.from('payment_receipts').select('*, students(first_name,last_name,reg_number,grade), payment_allocations(amount,fee_types(name))').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(100) : null;
  if (receipts?.error) throw receipts.error;
  const cashData = financial ? await loadCashEntries(schoolId, '', '') : undefined;
  const terms = await supabase.from('school_terms').select('*').eq('school_id', schoolId).order('year').order('term');
  if (terms.error) throw terms.error;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId) throw new Error('Sign in again before saving records');
  const pending = (await listPayments(userId, schoolId)).filter((p) => p.status === 'pending');
  const syncedReferences: string[] = [];
  for (const payment of pending) {
    const result = await supabase.from('payment_receipts').select('id').eq('school_id', schoolId).eq('client_reference', payment.id).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) syncedReferences.push(payment.id);
  }
  await saveCollectionPack({ key: `${userId}:${schoolId}`, userId, schoolId, expiresAt: access.expiresAt, savedAt: Date.now(), students, fees: feeRows, balances, arrears, receipts: receipts?.data ?? [], cashData, terms: terms.data ?? [], syncedReferences });
}
export function applyPending(balances: Balance[], payments: QueuedPayment[], studentId: string) {
  return balances.filter((b) => b.student_id === studentId).map((b) => {
    const amount = payments.filter((p) => p.studentId === studentId && p.status === 'pending').flatMap((p) => p.items).filter((i) => i.fee_type_id === b.fee_type_id).reduce((s, i) => s + i.amount, 0);
    return { ...b, paid: Math.round((Number(b.paid) + amount) * 100) / 100, balance: Math.round((Number(b.balance) - amount) * 100) / 100 };
  });
}
export async function queuePayment(payment: QueuedPayment) {
  const access = await readOfflineAccess();
  const membership = access?.memberships.find((m) => m.school_id === payment.schoolId);
  if (access?.userId !== payment.userId || !membership || !(ROLE_PERMS[membership.role] ?? []).includes('finance')) throw new Error('Sign in again before collecting');
  const pack = await readCollectionPack(payment.userId, payment.schoolId);
  if (!pack || !pack.students.some((s) => s.id === payment.studentId && s.status === 'active')) throw new Error('Reconnect to save this student for offline collection');
  if (!['Cash (USD)', 'Cash (ZiG)'].includes(payment.receipt.method) || payment.status !== 'pending' || payment.items.length === 0 || payment.items.some((i) => !Number.isFinite(i.amount) || i.amount <= 0 || Math.abs(i.amount * 100 - Math.round(i.amount * 100)) > 0.000001 || !pack.fees.some((f) => f.id === i.fee_type_id)) || Math.round(payment.items.reduce((sum, item) => sum + item.amount, 0) * 100) !== Math.round(payment.receipt.total * 100)) throw new Error('Choose cash and valid fee amounts');
  await db().payments.add(payment); collectionChanged();
}
const syncing = new Map<string, Promise<void>>();
export function syncPayments(userId: string, schoolId: string) {
  const key = `${userId}:${schoolId}`;
  const existing = syncing.get(key);
  if (existing) return existing;
  const task = (async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id !== userId) throw new Error('Sign in again to sync receipts');
    for (const payment of (await listPayments(userId, schoolId)).filter((p) => p.status === 'pending')) {
      try {
        const r = payment.receipt;
        const result = await supabase.rpc('sync_cash_payment', { _school: schoolId, _student: payment.studentId, _client_reference: payment.id, _paid_on: r.paid_on, _year: r.year, _term: r.term, _method: r.method, _reference: r.reference ?? '', _notes: r.notes ?? '', _items: payment.items });
        if (result.error) throw result.error;
        const receipt = await supabase.from('payment_receipts').select('receipt_number').eq('id', result.data).single();
        if (receipt.error) throw receipt.error;
        // Refresh the authoritative pack before removing its pending balance overlay.
        const session = await supabase.auth.getSession();
        if (!session.data.session?.expires_at) throw new Error('Session expired');
        await prepareCollection(userId, schoolId, session.data.session.expires_at * 1000);
        await db().payments.update(payment.id, { status: 'synced', officialNumber: receipt.data.receipt_number, error: '' });
      } catch (error) {
        await db().payments.update(payment.id, { error: error instanceof Error ? error.message : 'Receipt not synced; retry when connected' });
        throw error;
      } finally { collectionChanged(); }
    }
  })().finally(() => { syncing.delete(key); });
  syncing.set(key, task);
  return task;
}