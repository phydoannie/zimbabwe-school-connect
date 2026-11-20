import { expect, test } from 'vitest';
import { toBase } from '@/lib/currency';
test('500 ZAR at 18.5 per USD becomes 27.03 USD', () => { expect(toBase(500, 18.5)).toBe(27.03); });
test('main currency at rate 1 is unchanged', () => { expect(toBase(40, 1)).toBe(40); });
