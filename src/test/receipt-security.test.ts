import { describe, expect, it } from 'vitest';
import { csvCell } from '@/lib/csv';
import { validReceiptStart } from '@/lib/receipt-settings';
import { validPairingToken } from '@/lib/device-pair-policy';
describe('receipt and export safeguards', () => {
  it('receipt start numbers must be positive whole numbers', () => {
    expect(validReceiptStart(1200)).toBe(true);
    expect(validReceiptStart(0)).toBe(false);
    expect(validReceiptStart(1.2)).toBe(false);
    expect(validReceiptStart(Infinity)).toBe(false);
  });
  it('student formula fields are harmless in exported spreadsheets', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell(' \t@SUM(1)')).toBe('"\' \t@SUM(1)"');
    expect(csvCell('Name "quoted"')).toBe('"Name ""quoted"""');
    expect(csvCell(12.5)).toBe('"12.5"');
  });
  it('public device identifiers are not device approval credentials', () => {
    expect(validPairingToken('android-device-id')).toBe(false);
    expect(validPairingToken('a'.repeat(64))).toBe(true);
    expect(validPairingToken(null)).toBe(false);
  });
});