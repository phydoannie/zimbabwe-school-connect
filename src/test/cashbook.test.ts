import { describe, it, expect } from "vitest";
import { buildCashBook } from "@/lib/cashbook";
const e = (id: string, date: string, kind: "in" | "out", amount: number) => ({ id, date, kind, amount, detail: "", ref: "", method: "Cash", account: "" });
describe("cash book", () => {
  it("running balance starts from opening, receipts add and payments subtract in date order", () => {
    const rows = buildCashBook([e("b", "2026-02-02", "out", 30), e("a", "2026-02-01", "in", 100), e("c", "2026-02-02", "in", 5)], 10);
    expect(rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(rows.map((r) => r.balance)).toEqual([110, 115, 85]);
  });
});
