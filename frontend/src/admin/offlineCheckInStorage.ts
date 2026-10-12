export const rosterCacheKey = "wedding-rsvp-check-in-roster";
export const pendingCheckInsKey = "wedding-rsvp-pending-check-ins";

export function clearOfflineCheckInStorage(): void {
  sessionStorage.removeItem(rosterCacheKey);
  sessionStorage.removeItem(pendingCheckInsKey);
}
