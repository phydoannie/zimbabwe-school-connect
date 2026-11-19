import { describe, expect, it } from 'vitest';
import { subscriptionState, subscriptionAllowsAccess, type Subscription } from '@/lib/subscriptions';
const now = Date.parse('2026-11-19T12:00:00Z');
const sub = (days: number, status = 'active'): Subscription => ({ school_id: 'a', slug: 'school-a', status, subscription_ends_at: new Date(now + days * 86400000).toISOString() });
describe('School subscriptions', () => {
  it('warns exactly seven days before expiry', () => { expect(subscriptionState(sub(7), now)).toBe('expiring'); expect(subscriptionState(sub(7.01), now)).toBe('active'); });
  it('denies access at expiry', () => { expect(subscriptionAllowsAccess(sub(0), now)).toBe(false); expect(subscriptionAllowsAccess(sub(1), now)).toBe(true); });
  it('suspends only the selected school', () => { expect(subscriptionAllowsAccess(sub(30, 'suspended'), now)).toBe(false); expect(subscriptionAllowsAccess({ ...sub(30), school_id: 'b' }, now)).toBe(true); });
  it('denies missing subscriptions', () => { expect(subscriptionAllowsAccess(null, now)).toBe(false); });
});