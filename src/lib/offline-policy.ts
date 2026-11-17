// Offline permission is a local convenience only; every upload is authorized again by the server.
export const OFFLINE_ACCESS_MS = 7 * 24 * 60 * 60 * 1000;
export function offlineAccessValid(verifiedAt: number, expiresAt: number, now = Date.now()) {
  return now >= verifiedAt && now < expiresAt && expiresAt <= verifiedAt + OFFLINE_ACCESS_MS;
}