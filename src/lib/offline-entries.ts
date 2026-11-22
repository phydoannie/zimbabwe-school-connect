import Dexie, { type Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import { readOfflineAccess } from './offline-cache';
import { ROLE_PERMS } from './constants';
import { subscriptionAllowsAccess } from './subscriptions';
import type { CollectionPack } from './offline-payments';

export type StudentInput = { reg_number: string; first_name: string; last_name: string; grade: string; class_name: string; gender: string; boarding: boolean; guardian_name: string; guardian_phone: string };
export type ExpenseInput = { spent_on: string; category: string; account: string; description: string; amount: number; method: string; voucher_reference: string };
type Common = { id: string; userId: string; schoolId: string; createdAt: string; status: 'pending' | 'synced'; error?: string };
export type OfflineEntry = Common & ({ kind: 'student'; payload: { student: StudentInput; arrears: { fee_type_id: string; amount: number }[] } } | { kind: 'expense'; payload: ExpenseInput });
class EntryDatabase extends Dexie {
  declare entries: Table<OfflineEntry, string>;
  constructor() { super('schoolsys-entries-v1'); this.version(1).stores({ entries: 'id,[userId+schoolId],status' }); }
}
let database: EntryDatabase | undefined;
const db = () => database ??= new EntryDatabase();
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('collections-changed')); };
export function listEntries(userId: string, schoolId: string) { return db().entries.where('[userId+schoolId]').equals([userId, schoolId]).sortBy('createdAt'); }
const moneyValid = (amount: number) => Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;

export async function queueEntry(entry: OfflineEntry) {
  const access = await readOfflineAccess();
  const member = access?.memberships.find(m => m.school_id === entry.schoolId);
  const perms = ROLE_PERMS[member?.role ?? ''] ?? [];
  if (access?.userId !== entry.userId || !member || !subscriptionAllowsAccess(member.subscription) || !perms.includes(entry.kind === 'student' ? 'students' : 'finance')) throw new Error('Sign in online again before adding records');
  if (entry.status !== 'pending') throw new Error('New entries must be pending');
  const { readCollectionPack } = await import('./offline-payments');
  const pack = await readCollectionPack(entry.userId, entry.schoolId);
  if (!pack) throw new Error('Connect and sync school records before adding offline');
  if (entry.kind === 'student') {
    const { student, arrears } = entry.payload;
    if (!student.first_name.trim() || !student.last_name.trim() || !student.reg_number.trim() || !student.grade.trim()) throw new Error('Student details required');
    if (pack.students.some(s => s.reg_number.trim().toLowerCase() === student.reg_number.trim().toLowerCase())) throw new Error('That registration number already exists');
    if ((arrears.length > 0 && !perms.includes('finance')) || arrears.some(a => !moneyValid(a.amount) || !pack.fees.some(f => f.id === a.fee_type_id))) throw new Error('Enter valid arrears for this school’s fee types');
  } else {
    const expense = entry.payload;
    if (!moneyValid(expense.amount) || expense.amount <= 0 || !expense.description.trim() || !expense.category || !expense.account || !expense.method || !/^\d{4}-\d{2}-\d{2}$/.test(expense.spent_on) || Number.isNaN(Date.parse(expense.spent_on))) throw new Error('Enter valid expense details');
  }
  // add, never put: an immutable reference cannot be overwritten before upload.
  await db().entries.add(entry);
  changed();
}

export function overlayEntries(pack: CollectionPack, entries: OfflineEntry[]): CollectionPack {
  const result: CollectionPack = { ...pack, students: [...pack.students], balances: [...pack.balances], arrears: [...(pack.arrears ?? [])], ...(pack.cashData ? { cashData: { entries: [...pack.cashData.entries], allocations: [...pack.cashData.allocations], expenses: [...pack.cashData.expenses] } } : {}) };
  for (const entry of entries.filter(e => e.userId === pack.userId && e.schoolId === pack.schoolId)) {
    if (entry.kind === 'student' && !result.students.some(s => s.id === entry.id)) {
      const s = entry.payload.student;
      result.students.push({ ...s, id: entry.id, school_id: pack.schoolId, status: 'active', opening_balance: 0, created_at: entry.createdAt });
      for (const fee of pack.fees.filter(f => entry.payload.arrears.some(a => a.fee_type_id === f.id) || (f.active && (f.applies_to.length === 0 || f.applies_to.includes(s.grade)) && (!f.boarding_only || s.boarding)))) {
        const amount = entry.payload.arrears.find(a => a.fee_type_id === fee.id)?.amount ?? 0;
        result.arrears?.push({ student_id: entry.id, fee_type_id: fee.id, amount });
        result.balances.push({ student_id: entry.id, reg_number: s.reg_number, full_name: `${s.first_name} ${s.last_name}`, grade: s.grade, guardian_phone: s.guardian_phone, fee_type_id: fee.id, fee_name: fee.name, account: fee.account, due: amount, paid: 0, balance: amount });
      }
    } else if (entry.kind === 'expense' && result.cashData && !result.cashData.expenses.some(e => e.id === entry.id)) {
      result.cashData.expenses.push({ ...entry.payload, id: entry.id, school_id: pack.schoolId, recorded_by: entry.userId, created_at: entry.createdAt });
      result.cashData.entries.push({ id: entry.id, date: entry.payload.spent_on, kind: 'out', detail: `${entry.payload.category} — ${entry.payload.description}`, ref: entry.payload.voucher_reference, method: entry.payload.method, account: entry.payload.account, amount: entry.payload.amount });
    }
  }
  return result;
}

const syncing = new Map<string, Promise<void>>();
export function syncEntries(userId: string, schoolId: string) {
  const key = `${userId}:${schoolId}`;
  const existing = syncing.get(key);
  if (existing) return existing;
  const task = (async () => {
    const identity = await supabase.auth.getUser();
    if (identity.error || identity.data.user?.id !== userId) throw new Error('Sign in again to sync entries');
    for (const entry of (await listEntries(userId, schoolId)).filter(e => e.status === 'pending')) {
      try {
        const result = await supabase.rpc('sync_offline_entry', { _school: schoolId, _reference: entry.id, _kind: entry.kind, _payload: entry.payload });
        if (result.error) throw result.error;
        await db().entries.update(entry.id, { status: 'synced', error: '' });
      } catch (error) {
        await db().entries.update(entry.id, { error: error instanceof Error ? error.message : 'Could not sync; retry when connected' });
        throw error;
      } finally { changed(); }
    }
  })().finally(() => syncing.delete(key));
  syncing.set(key, task);
  return task;
}