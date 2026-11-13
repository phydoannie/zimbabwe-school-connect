import { refuseServiceWorker } from './pwa-policy';

export async function registerOfflineApp() {
  if (!('serviceWorker' in navigator)) return;
  if (refuseServiceWorker(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get('sw') === 'off')) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((r) => [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === '/sw.js')).map((r) => r.unregister()));
    return;
  }
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}