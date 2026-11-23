import { describe, it, expect } from "vitest";
import { dayEndSummary } from "@/lib/dayend";
const e = (kind: "in" | "out", account: string, amount: number, method = "Cash (USD)") => ({ id: Math.random().toString(), date: "2026-11-23", kind, account, amount, method, detail: "", ref: "" });
describe("day-end report", () => {
  it("separates fees from other income like rent and tuck shop and nets expenses", () => {
    const s = dayEndSummary([e("in", "Fees", 100), e("in", "Rent", 50), e("in", "Tuck shop", 20.5, "EcoCash"), e("out", "General Levy", 30)]);
    expect(s.fees).toBe(100); expect(s.other).toBe(70.5); expect(s.totalIn).toBe(170.5); expect(s.spent).toBe(30); expect(s.net).toBe(140.5);
    expect(s.byMethod.find((m) => m.name === "EcoCash")?.total).toBe(20.5);
  });
});
