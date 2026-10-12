import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import QrScanner from "qr-scanner";

import { ApiError } from "../lib/api";
import {
  checkInAdministratorGuest,
  checkOutAdministratorGuest,
  exportAdministratorCheckInRoster,
  listAdministratorGuests,
} from "./api";
import type { AdminGuest, AdminRole } from "./types";

const VENUE_CAPACITY = 150;

function invitationCodeFromQr(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return (url.searchParams.get("invite") ?? url.searchParams.get("code") ?? "").trim().toUpperCase();
  } catch {
    return trimmed.toUpperCase();
  }
}

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
  const [isExporting, setIsExporting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scannedGuest, setScannedGuest] = useState<AdminGuest | null>(null);
  const [companionArrivalCount, setCompanionArrivalCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
  const expectedPeople = attending.reduce((total, guest) => total + 1 + guest.companion_count, 0);
  const checkedInPeople = attending.reduce(
    (total, guest) => total + (guest.checked_in_at ? 1 + guest.checked_in_companion_count : 0),
    0,
  );
  const remainingCapacity = VENUE_CAPACITY - expectedPeople;
  const filteredGuests = attending.filter((guest) => {
    const text = `${guest.full_name} ${guest.invitation_code} ${guest.household_name ?? ""}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "checked_in" ? guest.checked_in_at !== null : guest.checked_in_at === null);
    return matchesQuery && matchesFilter;
  });

  const resolveInvitation = useCallback((value: string): void => {
    const invitationCode = invitationCodeFromQr(value);
    const guest = guests.find((item) => item.invitation_code.toUpperCase() === invitationCode);
    if (!invitationCode || !guest) {
      setScannedGuest(null);
      setScanMessage("No guest matches that invitation code.");
      return;
    }
    if (guest.rsvp_status !== "attending") {
      setScannedGuest(null);
      setScanMessage(`${guest.full_name} does not have an attending RSVP.`);
      return;
    }
    setScannedGuest(guest);
    setCompanionArrivalCount(guest.checked_in_at ? guest.checked_in_companion_count : guest.companion_count);
    setScanMessage(guest.checked_in_at ? `${guest.full_name} is already checked in.` : "Invitation found. Confirm the guest before checking in.");
    setIsScannerOpen(false);
  }, [guests]);

  useEffect(() => {
    if (!isScannerOpen) return;
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanMessage("Camera access is unavailable. Enter the invitation code below.");
      return;
    }

    const scanner = new QrScanner(
      videoElement,
      (result) => resolveInvitation(result.data),
      {
        preferredCamera: "environment",
        maxScansPerSecond: 8,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    );
    scanner.start()
      .then(() => setScanMessage("Camera ready. Hold the invitation QR code inside the frame."))
      .catch(() => setScanMessage("Camera access was not granted. Enter the invitation code below."));

    return () => {
      scanner.destroy();
      videoElement.srcObject = null;
    };
  }, [isScannerOpen, resolveInvitation]);

  function submitManualCode(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    resolveInvitation(manualCode);
  }

  async function toggleCheckIn(guest: AdminGuest, companionCount = guest.companion_count): Promise<void> {
    if (role === "viewer") return;
    setBusyGuestId(guest.id);
    setErrorMessage("");
    try {
      const response = guest.checked_in_at
        ? await checkOutAdministratorGuest(accessToken, guest.id)
        : await checkInAdministratorGuest(accessToken, guest.id, companionCount);
      setGuests((current) => current.map((item) => item.id === guest.id ? response.guest : item));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The check-in could not be updated.");
    } finally {
      setBusyGuestId(null);
    }
  }

  async function savePartyArrival(guest: AdminGuest): Promise<void> {
    if (role === "viewer") return;
    setBusyGuestId(guest.id);
    setErrorMessage("");
    try {
      const response = await checkInAdministratorGuest(accessToken, guest.id, companionArrivalCount);
      setGuests((current) => current.map((item) => item.id === guest.id ? response.guest : item));
      setScannedGuest(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The party check-in could not be updated.");
    } finally {
      setBusyGuestId(null);
    }
  }

  async function exportRoster(): Promise<void> {
    setIsExporting(true);
    setErrorMessage("");
    try {
      const blob = await exportAdministratorCheckInRoster(accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wedding-check-in-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The check-in roster could not be exported.");
    } finally {
      setIsExporting(false);
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
        <div className="admin-section-actions">
          <button type="button" disabled={isExporting} onClick={() => void exportRoster()}>{isExporting ? "Exporting..." : "Export CSV"}</button>
          <button type="button" onClick={() => { setScanMessage(""); setScannedGuest(null); setIsScannerOpen(true); }}>Scan QR code</button>
        </div>
      </div>

      <div className="admin-checkin-summary" aria-label="Check-in totals">
        <article><span>Venue capacity</span><strong>{VENUE_CAPACITY}</strong></article>
        <article><span>Expected people</span><strong>{expectedPeople}</strong></article>
        <article><span>People checked in</span><strong>{checkedInPeople}</strong></article>
        <article><span>People waiting</span><strong>{expectedPeople - checkedInPeople}</strong></article>
        <article className={remainingCapacity < 0 ? "is-over-capacity" : ""}><span>{remainingCapacity < 0 ? "Over capacity" : "Capacity remaining"}</span><strong>{Math.abs(remainingCapacity)}</strong></article>
        <article><span>Progress</span><strong>{expectedPeople ? Math.round((checkedInPeople / expectedPeople) * 100) : 0}%</strong></article>
      </div>

      {remainingCapacity < 0 ? <p className="admin-capacity-warning" role="alert">Confirmed attendance is {Math.abs(remainingCapacity)} people above the 150-person venue capacity.</p> : null}

      <div className="admin-checkin-filters">
        <input aria-label="Search attending guests" placeholder="Search name, invitation code, or guest group" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter check-in status" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All attending guests</option>
          <option value="waiting">Waiting to check in</option>
          <option value="checked_in">Checked in</option>
        </select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-guest-table admin-checkin-table">
          <thead><tr><th>Guest</th><th>Invitation</th><th>Guest group</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="admin-table-message">Loading attending guests...</td></tr> : null}
            {!isLoading && filteredGuests.length === 0 ? <tr><td colSpan={5} className="admin-table-message">No attending guests match these filters.</td></tr> : null}
            {filteredGuests.map((guest) => (
              <tr key={guest.id} className={guest.checked_in_at ? "is-checked-in" : ""}>
                <td><strong>{guest.full_name}</strong><small>{guest.email ?? guest.phone_number ?? "No contact details"}</small></td>
                <td><code>{guest.invitation_code}</code></td>
                <td>{guest.household_name ?? "—"}</td>
                <td>{guest.checked_in_at ? <span className="admin-status-pill is-attending">{1 + guest.checked_in_companion_count} of {1 + guest.companion_count} arrived</span> : <span className="admin-status-pill">Waiting · party of {1 + guest.companion_count}</span>}{guest.checked_in_at ? <small>{new Date(guest.checked_in_at).toLocaleString()}</small> : null}</td>
                <td><button className={guest.checked_in_at ? "admin-checkout-button" : "admin-checkin-button"} type="button" disabled={role === "viewer" || busyGuestId === guest.id} onClick={() => void toggleCheckIn(guest)}>{busyGuestId === guest.id ? "Saving..." : guest.checked_in_at ? "Undo check-in" : "Check in"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {role === "viewer" ? <p className="admin-content-help">Viewer accounts can monitor arrivals but cannot change check-in status.</p> : null}

      {isScannerOpen ? (
        <div className="admin-editor-backdrop" role="presentation">
          <section className="admin-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-title">
            <header><div><p className="admin-status-label">Fast check-in</p><h3 id="qr-title">Scan invitation QR</h3></div><button type="button" onClick={() => setIsScannerOpen(false)}>Close</button></header>
            <video ref={videoRef} muted playsInline aria-label="QR scanner camera preview" />
            <p>Point the camera at the invitation QR code.</p>
            {scanMessage ? <p className="admin-qr-message" role="status">{scanMessage}</p> : null}
            <form onSubmit={submitManualCode}>
              <label htmlFor="manual-invitation-code">Or enter invitation code</label>
              <div><input id="manual-invitation-code" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="JP-JOYCE-..." autoComplete="off" /><button type="submit">Find guest</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {scannedGuest ? (
        <div className="admin-editor-backdrop" role="presentation">
          <section className="admin-qr-dialog admin-qr-confirm" role="dialog" aria-modal="true" aria-labelledby="qr-confirm-title">
            <header><div><p className="admin-status-label">Invitation found</p><h3 id="qr-confirm-title">{scannedGuest.full_name}</h3></div><button type="button" onClick={() => setScannedGuest(null)}>Close</button></header>
            <dl><div><dt>Invitation</dt><dd>{scannedGuest.invitation_code}</dd></div><div><dt>Guest group</dt><dd>{scannedGuest.household_name ?? "Unassigned"}</dd></div><div><dt>Party size</dt><dd>{1 + scannedGuest.companion_count}</dd></div><div><dt>Status</dt><dd>{scannedGuest.checked_in_at ? `${1 + scannedGuest.checked_in_companion_count} arrived` : "Waiting"}</dd></div></dl>
            <p className="admin-qr-message">{scanMessage}</p>
            {scannedGuest.companion_count > 0 ? <label className="admin-party-arrivals">Companions arrived<select value={companionArrivalCount} onChange={(event) => setCompanionArrivalCount(Number(event.target.value))}>{Array.from({ length: scannedGuest.companion_count + 1 }, (_, count) => <option key={count} value={count}>{count}</option>)}</select></label> : null}
            <button className="admin-checkin-button" type="button" disabled={role === "viewer" || busyGuestId === scannedGuest.id} onClick={() => void savePartyArrival(scannedGuest)}>{busyGuestId === scannedGuest.id ? "Saving..." : scannedGuest.checked_in_at ? "Update party arrival" : `Confirm ${1 + companionArrivalCount} ${1 + companionArrivalCount === 1 ? "person" : "people"}`}</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}
