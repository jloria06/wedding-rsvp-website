import { useEffect, useMemo, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";

import { ApiError } from "../lib/api";
import {
  createAdministratorGuest,
  deactivateAdministratorGuest,
  listAdministratorGuests,
  markAdministratorInvitationSent,
  updateAdministratorGuest,
} from "./api";
import type {
  AdminGuest,
  AdminRole,
  AgeGroup,
  GuestInput,
  GuestStatus,
  GuestUpdate,
  RSVPStatus,
} from "./types";

type GuestDraft = {
  invitation_code: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  household_name: string;
  maximum_companions: string;
  age_group: AgeGroup;
  is_primary_guest: boolean;
  status: GuestStatus;
};

const emptyDraft = (): GuestDraft => ({
  invitation_code: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  household_name: "",
  maximum_companions: "0",
  age_group: "adult",
  is_primary_guest: true,
  status: "invited",
});

function rsvpLabel(status: RSVPStatus | null): string {
  if (status === "not_attending") return "Declined";
  if (status === "attending") return "Attending";
  return "Pending";
}

function invitationUrl(invitationCode: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set("invite", invitationCode);
  url.hash = "rsvp";
  return url.toString();
}

export function GuestManagement({
  accessToken,
  role,
}: {
  accessToken: string;
  role: AdminRole;
}) {
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestStatus | "all">("all");
  const [rsvpFilter, setRsvpFilter] = useState<RSVPStatus | "pending" | "all">("all");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "sent" | "not_sent">("all");
  const [editingGuest, setEditingGuest] = useState<AdminGuest | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<GuestDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [invitationGuest, setInvitationGuest] = useState<AdminGuest | null>(null);
  const [invitationFeedback, setInvitationFeedback] = useState("");
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const canManage = role !== "viewer";

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listAdministratorGuests(accessToken)
      .then((response) => {
        if (!active) return;
        setGuests(response.guests);
        setErrorMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Guests could not be loaded.");
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, reloadKey]);

  const filteredGuests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return guests.filter((guest) => {
      const matchesSearch = !query || [guest.full_name, guest.invitation_code, guest.email, guest.household_name]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || guest.status === statusFilter;
      const normalizedRsvp = guest.rsvp_status ?? "pending";
      const matchesRsvp = rsvpFilter === "all" || normalizedRsvp === rsvpFilter;
      const matchesDelivery = deliveryFilter === "all"
        || (deliveryFilter === "sent" && Boolean(guest.invitation_sent_at))
        || (deliveryFilter === "not_sent" && !guest.invitation_sent_at);
      return matchesSearch && matchesStatus && matchesRsvp && matchesDelivery;
    });
  }, [deliveryFilter, guests, rsvpFilter, search, statusFilter]);

  function openCreate(): void {
    setEditingGuest(null);
    setDraft(emptyDraft());
    setIsCreating(true);
    setErrorMessage("");
  }

  function openEdit(guest: AdminGuest): void {
    setEditingGuest(guest);
    setIsCreating(false);
    setDraft({
      invitation_code: guest.invitation_code,
      first_name: guest.first_name,
      middle_name: guest.middle_name ?? "",
      last_name: guest.last_name,
      email: guest.email ?? "",
      phone_number: guest.phone_number ?? "",
      household_name: guest.household_name ?? "",
      maximum_companions: String(guest.maximum_companions),
      age_group: guest.age_group,
      is_primary_guest: guest.is_primary_guest,
      status: guest.status,
    });
    setErrorMessage("");
  }

  function closeEditor(): void {
    setEditingGuest(null);
    setIsCreating(false);
  }

  async function saveGuest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    const base = {
      first_name: draft.first_name.trim(),
      middle_name: draft.middle_name.trim() || null,
      last_name: draft.last_name.trim(),
      email: draft.email.trim() || null,
      phone_number: draft.phone_number.trim() || null,
      household_name: draft.household_name.trim() || null,
      maximum_companions: Number(draft.maximum_companions),
      age_group: draft.age_group,
      is_primary_guest: draft.is_primary_guest,
    };
    try {
      if (editingGuest) {
        await updateAdministratorGuest(accessToken, editingGuest.id, { ...base, status: draft.status } as GuestUpdate);
      } else {
        await createAdministratorGuest(accessToken, { ...base, invitation_code: draft.invitation_code.trim() } as GuestInput);
      }
      closeEditor();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The guest could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivate(guest: AdminGuest): Promise<void> {
    if (!window.confirm(`Deactivate ${guest.full_name}? Their invitation will no longer work.`)) return;
    try {
      await deactivateAdministratorGuest(accessToken, guest.id);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The guest could not be deactivated.");
    }
  }

  function openInvitation(guest: AdminGuest): void {
    setInvitationGuest(guest);
    setInvitationFeedback("");
  }

  async function copyInvitationLink(): Promise<void> {
    if (!invitationGuest) return;

    try {
      await navigator.clipboard.writeText(
        invitationUrl(invitationGuest.invitation_code),
      );
      setInvitationFeedback("Invitation link copied.");
    } catch {
      setInvitationFeedback("Copy failed. Select and copy the link below.");
    }
  }

  async function markInvitationSent(): Promise<void> {
    if (!invitationGuest || !canManage) return;

    setIsMarkingSent(true);
    setInvitationFeedback("");

    try {
      const response = await markAdministratorInvitationSent(
        accessToken,
        invitationGuest.id,
      );
      setInvitationGuest(response.guest);
      setGuests((current) =>
        current.map((guest) =>
          guest.id === response.guest.id ? response.guest : guest,
        ),
      );
      setInvitationFeedback("Invitation marked as sent.");
    } catch (error) {
      setInvitationFeedback(
        error instanceof ApiError ? error.message : "Status could not be updated.",
      );
    } finally {
      setIsMarkingSent(false);
    }
  }

  const editorOpen = isCreating || editingGuest !== null;

  return (
    <section className="admin-guests" aria-labelledby="guest-management-title">
      <div className="admin-section-heading">
        <div><p className="admin-status-label">Phase 9</p><h2 id="guest-management-title">Guest management</h2><p>{guests.length} active invitation records</p></div>
        {canManage ? <button type="button" onClick={openCreate}>Add guest</button> : null}
      </div>

      <div className="admin-guest-filters">
        <input aria-label="Search guests" placeholder="Search name, code, email, or household" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter guest status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GuestStatus | "all")}><option value="all">All guest statuses</option><option value="invited">Invited</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select>
        <select aria-label="Filter RSVP status" value={rsvpFilter} onChange={(e) => setRsvpFilter(e.target.value as RSVPStatus | "pending" | "all")}><option value="all">All RSVP statuses</option><option value="pending">Pending</option><option value="attending">Attending</option><option value="not_attending">Declined</option></select>
        <select aria-label="Filter invitation delivery" value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as "all" | "sent" | "not_sent")}><option value="all">All delivery statuses</option><option value="sent">Sent</option><option value="not_sent">Not sent</option></select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {isLoading ? (
        <p className="admin-table-message">Loading guests...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-guest-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Invitation</th>
                <th>Delivery</th>
                <th>Seats</th>
                <th>Age</th>
                <th>Guest status</th>
                <th>RSVP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    <strong>{guest.full_name}</strong>
                    <small>
                      {guest.household_name || guest.email || "No contact details"}
                    </small>
                  </td>
                  <td><code>{guest.invitation_code}</code></td>
                  <td>
                    {guest.invitation_sent_at ? (
                      <span className="admin-delivery-status is-sent">
                        Sent {new Date(guest.invitation_sent_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="admin-delivery-status">Not sent</span>
                    )}
                  </td>
                  <td>{guest.maximum_companions + 1}</td>
                  <td className="admin-capitalize">{guest.age_group}</td>
                  <td className="admin-capitalize">{guest.status}</td>
                  <td>{rsvpLabel(guest.rsvp_status)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => openInvitation(guest)}>
                        Invitation
                      </button>
                      {canManage ? (
                        <>
                          <button type="button" onClick={() => openEdit(guest)}>
                            Edit
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            onClick={() => void deactivate(guest)}
                          >
                            Deactivate
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-message">
                    No guests match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen ? <div className="admin-editor-backdrop"><section className="admin-guest-editor" aria-labelledby="guest-editor-title"><div className="admin-editor-header"><div><p className="admin-status-label">{editingGuest ? "Edit invitation" : "New invitation"}</p><h2 id="guest-editor-title">{editingGuest ? editingGuest.full_name : "Add guest"}</h2></div><button type="button" onClick={closeEditor}>Close</button></div><form onSubmit={saveGuest}>
        <label>Invitation code<input value={draft.invitation_code} onChange={(e) => setDraft({...draft, invitation_code:e.target.value.toUpperCase()})} disabled={Boolean(editingGuest)} minLength={4} required /></label>
        <div className="admin-form-grid"><label>First name<input value={draft.first_name} onChange={(e) => setDraft({...draft, first_name:e.target.value})} required /></label><label>Middle name<input value={draft.middle_name} onChange={(e) => setDraft({...draft, middle_name:e.target.value})} /></label><label>Last name<input value={draft.last_name} onChange={(e) => setDraft({...draft, last_name:e.target.value})} required /></label><label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({...draft, email:e.target.value})} /></label><label>Phone<input value={draft.phone_number} onChange={(e) => setDraft({...draft, phone_number:e.target.value})} /></label><label>Household<input value={draft.household_name} onChange={(e) => setDraft({...draft, household_name:e.target.value})} /></label><label>Companion allowance<input type="number" min="0" max="20" value={draft.maximum_companions} onChange={(e) => setDraft({...draft, maximum_companions:e.target.value})} required /></label><label>Age group<select value={draft.age_group} onChange={(e) => setDraft({...draft, age_group:e.target.value as AgeGroup})}><option value="adult">Adult</option><option value="child">Child</option></select></label>{editingGuest ? <label>Guest status<select value={draft.status} onChange={(e) => setDraft({...draft, status:e.target.value as GuestStatus})}><option value="invited">Invited</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label> : null}</div>
        <label className="admin-checkbox"><input type="checkbox" checked={draft.is_primary_guest} onChange={(e) => setDraft({...draft, is_primary_guest:e.target.checked})} />Primary guest</label>
        <div className="admin-editor-actions"><button type="button" onClick={closeEditor}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save guest"}</button></div>
      </form></section></div> : null}

      {invitationGuest ? (
        <div className="admin-editor-backdrop">
          <section
            className="admin-guest-editor admin-invitation-card"
            aria-labelledby="invitation-card-title"
          >
            <div className="admin-editor-header">
              <div>
                <p className="admin-status-label">Guest invitation</p>
                <h2 id="invitation-card-title">{invitationGuest.full_name}</h2>
              </div>
              <button type="button" onClick={() => setInvitationGuest(null)}>
                Close
              </button>
            </div>

            <div className="admin-invitation-layout">
              <div className="admin-invitation-qr">
                <QRCodeSVG
                  value={invitationUrl(invitationGuest.invitation_code)}
                  size={220}
                  level="M"
                  marginSize={2}
                  title={`Invitation for ${invitationGuest.full_name}`}
                />
              </div>
              <div className="admin-invitation-details">
                <span>Invitation code</span>
                <strong>{invitationGuest.invitation_code}</strong>
                <label htmlFor="guest-invitation-link">Personal invitation link</label>
                <textarea
                  id="guest-invitation-link"
                  readOnly
                  rows={4}
                  value={invitationUrl(invitationGuest.invitation_code)}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <p>
                  {invitationGuest.invitation_sent_at
                    ? `Marked sent ${new Date(invitationGuest.invitation_sent_at).toLocaleString()}`
                    : "This invitation has not been marked as sent."}
                </p>
              </div>
            </div>

            {invitationFeedback ? (
              <p className="admin-success" role="status">{invitationFeedback}</p>
            ) : null}

            <div className="admin-editor-actions">
              <button type="button" onClick={() => void copyInvitationLink()}>
                Copy link
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => void markInvitationSent()}
                  disabled={isMarkingSent}
                >
                  {isMarkingSent ? "Saving..." : "Mark as sent"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
