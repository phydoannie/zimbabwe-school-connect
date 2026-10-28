import { describe, expect, it } from 'vitest';
import { ROLE_PERMS } from '@/lib/constants';
import { normalizeUsername, usernameEmail, validExpenseAmount } from '@/lib/accounts';
describe('Phase one access rules',()=>{
  it('Headmaster can view records and reports only',()=>expect(ROLE_PERMS.headmaster).toEqual(['view','reports']));
  it('Headmaster cannot collect fees',()=>expect(ROLE_PERMS.headmaster?.includes('finance')).toBe(false));
  it('Headmaster cannot edit students, fees, attendance, settings or users',()=>{for(const p of ['students','fees_setup','attendance','settings','users'])expect(ROLE_PERMS.headmaster).not.toContain(p);});
  it('Administrator manages accounts and expenses',()=>{expect(ROLE_PERMS.admin).toContain('users');expect(ROLE_PERMS.admin).toContain('settings');expect(ROLE_PERMS.admin).toContain('finance');});
  it('Uses normalized username credentials without collecting email',()=>expect(usernameEmail(' Admin ')).toBe('admin@accounts.schoolsys.local'));
  it('Rejects malformed usernames',()=>expect(()=>normalizeUsername('a@b')).toThrow());
  it('Expenses require a positive finite amount',()=>{expect(validExpenseAmount(2.5)).toBe(true);expect(validExpenseAmount(0)).toBe(false);expect(validExpenseAmount(-1)).toBe(false);expect(validExpenseAmount(Infinity)).toBe(false);});
});