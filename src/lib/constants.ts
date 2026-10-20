export const GRADES = [
  "ECD A", "ECD B",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7",
  "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6",
];

export const PAYMENT_METHODS = [
  "Cash (USD)", "Cash (ZiG)", "EcoCash", "OneMoney", "InnBucks", "Bank transfer", "Swipe / ZIPIT",
];

export const CURRENCIES = ["USD", "ZiG", "ZAR"];

export const ACCOUNTS = ["Tuition", "General Levy", "Sports Levy", "Building Fund", "Boarding", "Transport", "Exams"];

export const DEFAULT_FEE_NAMES = [
  "Tuition", "General Levy", "Sports Levy", "ZIMSEC Exam Fee", "Building Levy", "Boarding", "Transport", "Uniforms",
];

export const EXPENSE_CATEGORIES = [
  "Salaries & allowances", "Stationery", "Utilities (ZESA/Water)", "Fuel & transport", "Repairs & maintenance",
  "Food / boarding", "Sports", "ZIMSEC & exams", "Bank charges", "Other",
];

export const ROLE_LABELS: Record<string, string> = {
  head: "School Head",
  bursar: "Bursar",
  deputy_head: "Deputy Head",
  admin: "Administrator",
  teacher: "Teacher",
};

export type Perm = "view" | "students" | "finance" | "reports" | "fees_setup" | "attendance" | "settings" | "users";

// Mirrors public.has_perm in the database (database is authoritative).
export const ROLE_PERMS: Record<string, Perm[]> = {
  head: ["view", "students", "finance", "reports", "fees_setup", "attendance", "settings", "users"],
  admin: ["view", "students", "attendance", "settings", "users", "reports", "fees_setup"],
  bursar: ["view", "students", "finance", "reports", "fees_setup"],
  deputy_head: ["view", "students", "attendance"],
  teacher: ["view", "attendance"],
};

/** Grade 7 → Form 1 and exit classes must never be bulk promoted. */
export function canBulkPromote(from: string, to: string): boolean {
  const f = from.toLowerCase();
  if (f === "grade 7" || f === "form 4" || f === "form 6") return false;
  if (f === to.toLowerCase()) return false;
  return true;
}

export function nextGrade(g: string): string | null {
  const i = GRADES.indexOf(g);
  if (i < 0 || i === GRADES.length - 1) return null;
  return GRADES[i + 1];
}

export function money(n: number | string | null | undefined, cur = "USD") {
  const v = Number(n ?? 0);
  const prefix = cur === "USD" ? "$" : cur + " ";
  return prefix + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function sumAllocations(items: { amount: number }[]): number {
  return Math.round(items.reduce((s, i) => s + (Number(i.amount) || 0), 0) * 100) / 100;
}
