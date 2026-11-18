export type Subscription = { school_id: string; slug: string; status: string; subscription_ends_at: string };
export function subscriptionState(subscription: Subscription | null | undefined, now = Date.now()) {
  if (!subscription) return 'unavailable';
  if (subscription.status !== 'active') return 'suspended';
  const end = Date.parse(subscription.subscription_ends_at);
  if (!Number.isFinite(end) || end <= now) return 'expired';
  return end - now <= 7 * 86400000 ? 'expiring' : 'active';
}
export function subscriptionAllowsAccess(subscription: Subscription | null | undefined, now = Date.now()) {
  return ['active', 'expiring'].includes(subscriptionState(subscription, now));
}