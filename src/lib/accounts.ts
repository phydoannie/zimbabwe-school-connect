export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 letters, numbers, dots, underscores or hyphens.');
  return username;
}
export function usernameEmail(value: string) {
  return `${normalizeUsername(value)}@accounts.schoolsys.local`;
}
export const STAFF_ROLES = ['admin', 'headmaster', 'bursar', 'deputy_head', 'teacher'] as const;
export function validExpenseAmount(value: number) { return Number.isFinite(value) && value > 0; }