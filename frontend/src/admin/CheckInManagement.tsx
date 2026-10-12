import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../lib/api";
import {
  checkInAdministratorGuest,
  checkOutAdministratorGuest,
  listAdministratorGuests,
} from "./api";
import type { AdminGuest, AdminRole } from "./types";

export function CheckInManagement({
  accessToken,
  role,
}: {
  accessToken: string;
  role: AdminRole;
}) {
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "waiting" | "checked_in">("all");
  const [busyGuestId, setBusyGuestId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listAdministratorGuests(accessToken)
      .then((response) => setGuests(response.guests))
      .catch((error) => setErrorMessage(error instanceof ApiError ? error.message : "Guest check-in list could not be loaded."))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const attending = useMemo(
    () => guests.filter((guest) => guest.rsvp_status === "attending"),
    [guests],
  );
  const checkedIn = attending.filter((guest) => guest.checked_in_at !== null).length;
  const filteredGuests = attending.filter((guest) => {
    const text = `${guest.full_name} ${guest.invitation_code} ${guest.household_name ?? ""}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "checked_in" ? guest.checked_in_at !== null : guest.checked_in_at === null);
    return matchesQuery && matchesFilter;
  });

  async function toggleCheckIn(guest: AdminGuest): Promise<void> {
    if (role === "viewer") return;
    setBusyGuestId(guest.id);
    setErrorMessage("");
    try {
      const response = guest.checked_in_at
        ? await checkOutAdministratorGuest(accessToken, guest.id)
        : await checkInAdministratorGuest(accessToken, guest.id);
      setGuests((current) => current.map((item) => item.id === guest.id ? response.guest : item));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The check-in could not be updated.");
    } finally {
      setBusyGuestId(null);
    }
  }

  return (
    <section className="admin-checkin" aria-labelledby="checkin-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-status-label">Wedding day</p>
          <h2 id="checkin-title">Guest check-in</h2>
          <p>Confirm arrivals without changing RSVP responses.</p>
        </div>
      </div>

      <div className="admin-checkin-summary" aria-label="Check-in totals">
        <article><span>Expected</span><strong>{attending.length}</strong></article>
        <article><span>Checked in</span><strong>{checkedIn}</strong></article>
        <article><span>Waiting</span><strong>{attending.length - checkedIn}</strong></article>
        <article><span>Progress</span><strong>{attending.length ? Math.round((checkedIn / attending.length) * 100) : 0}%</strong></article>
      </div>

      <div className="admin-checkin-filters">
        <input aria-label="Search attending guests" placeholder="Search name, invitation code, or household" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter check-in status" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All attending guests</option>
          <option value="waiting">Waiting to check in</option>
          <option value="checked_in">Checked in</option>
        </select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-guest-table admin-checkin-table">
          <thead><tr><th>Guest</th><th>Invitation</th><th>Household</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="admin-table-message">Loading attending guests...</td></tr> : null}
            {!isLoading && filteredGuests.length === 0 ? <tr><td colSpan={5} className="admin-table-message">No attending guests match these filters.</td></tr> : null}
            {filteredGuests.map((guest) => (
              <tr key={guest.id} className={guest.checked_in_at ? "is-checked-in" : ""}>
                <td><strong>{guest.full_name}</strong><small>{guest.email ?? guest.phone_number ?? "No contact details"}</small></td>
                <td><code>{guest.invitation_code}</code></td>
                <td>{guest.household_name ?? "—"}</td>
                <td>{guest.checked_in_at ? <span className="admin-status-pill is-attending">Checked in</span> : <span className="admin-status-pill">Waiting</span>}{guest.checked_in_at ? <small>{new Date(guest.checked_in_at).toLocaleString()}</small> : null}</td>
                <td><button className={guest.checked_in_at ? "admin-checkout-button" : "admin-checkin-button"} type="button" disabled={role === "viewer" || busyGuestId === guest.id} onClick={() => void toggleCheckIn(guest)}>{busyGuestId === guest.id ? "Saving..." : guest.checked_in_at ? "Undo check-in" : "Check in"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {role === "viewer" ? <p className="admin-content-help">Viewer accounts can monitor arrivals but cannot change check-in status.</p> : null}
    </section>
  );
}
