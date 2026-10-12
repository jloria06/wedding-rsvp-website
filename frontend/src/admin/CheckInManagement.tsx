import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import {
  checkInAdministratorGuest,
  checkOutAdministratorGuest,
  listAdministratorGuests,
} from "./api";
import type { AdminGuest, AdminRole } from "./types";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scannedGuest, setScannedGuest] = useState<AdminGuest | null>(null);
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
  const checkedIn = attending.filter((guest) => guest.checked_in_at !== null).length;
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
    setScanMessage(guest.checked_in_at ? `${guest.full_name} is already checked in.` : "Invitation found. Confirm the guest before checking in.");
    setIsScannerOpen(false);
  }, [guests]);

  useEffect(() => {
    if (!isScannerOpen) return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const videoElement = videoRef.current;

    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanMessage("Camera QR scanning is unavailable in this browser. Enter the invitation code below.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((cameraStream) => {
        if (cancelled) {
          cameraStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = cameraStream;
        const video = videoElement;
        if (!video) return;
        video.srcObject = cameraStream;
        void video.play();
        const detector = new Detector({ formats: ["qr_code"] });
        timer = window.setInterval(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          detector.detect(video)
            .then((codes) => {
              if (codes[0]?.rawValue) resolveInvitation(codes[0].rawValue);
            })
            .catch(() => setScanMessage("The camera could not read that QR code. Hold it steady or enter the code below."));
        }, 350);
      })
      .catch(() => setScanMessage("Camera access was not granted. Enter the invitation code below."));

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [isScannerOpen, resolveInvitation]);

  function submitManualCode(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    resolveInvitation(manualCode);
  }

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
        <button type="button" onClick={() => { setScanMessage(""); setScannedGuest(null); setIsScannerOpen(true); }}>
          Scan QR code
        </button>
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
            <dl><div><dt>Invitation</dt><dd>{scannedGuest.invitation_code}</dd></div><div><dt>Household</dt><dd>{scannedGuest.household_name ?? "None"}</dd></div><div><dt>Status</dt><dd>{scannedGuest.checked_in_at ? "Already checked in" : "Waiting"}</dd></div></dl>
            <p className="admin-qr-message">{scanMessage}</p>
            {!scannedGuest.checked_in_at ? <button className="admin-checkin-button" type="button" disabled={role === "viewer" || busyGuestId === scannedGuest.id} onClick={() => { void toggleCheckIn(scannedGuest).then(() => setScannedGuest(null)); }}>{busyGuestId === scannedGuest.id ? "Checking in..." : "Confirm check-in"}</button> : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
