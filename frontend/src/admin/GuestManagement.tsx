import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import {
  createAdministratorGuest,
  deactivateAdministratorGuest,
  listAdministratorGuests,
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
  const [editingGuest, setEditingGuest] = useState<AdminGuest | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<GuestDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
      return matchesSearch && matchesStatus && matchesRsvp;
    });
  }, [guests, rsvpFilter, search, statusFilter]);

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

  const editorOpen = isCreating || editingGuest !== null;

  return (
    <section className="admin-guests" aria-labelledby="guest-management-title">
      <div className="admin-section-heading">
        <div><p className="admin-status-label">Phase 3</p><h2 id="guest-management-title">Guest management</h2><p>{guests.length} active invitation records</p></div>
        {canManage ? <button type="button" onClick={openCreate}>Add guest</button> : null}
      </div>

      <div className="admin-guest-filters">
        <input aria-label="Search guests" placeholder="Search name, code, email, or household" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter guest status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GuestStatus | "all")}><option value="all">All guest statuses</option><option value="invited">Invited</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select>
        <select aria-label="Filter RSVP status" value={rsvpFilter} onChange={(e) => setRsvpFilter(e.target.value as RSVPStatus | "pending" | "all")}><option value="all">All RSVP statuses</option><option value="pending">Pending</option><option value="attending">Attending</option><option value="not_attending">Declined</option></select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {isLoading ? <p className="admin-table-message">Loading guests...</p> : (
        <div className="admin-table-wrap"><table className="admin-guest-table"><thead><tr><th>Guest</th><th>Invitation</th><th>Seats</th><th>Age</th><th>Guest status</th><th>RSVP</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>
          {filteredGuests.map((guest) => <tr key={guest.id}><td><strong>{guest.full_name}</strong><small>{guest.household_name || guest.email || "No contact details"}</small></td><td><code>{guest.invitation_code}</code></td><td>{guest.maximum_companions + 1}</td><td className="admin-capitalize">{guest.age_group}</td><td className="admin-capitalize">{guest.status}</td><td>{rsvpLabel(guest.rsvp_status)}</td>{canManage ? <td><div className="admin-row-actions"><button type="button" onClick={() => openEdit(guest)}>Edit</button><button className="is-danger" type="button" onClick={() => void deactivate(guest)}>Deactivate</button></div></td> : null}</tr>)}
          {filteredGuests.length === 0 ? <tr><td colSpan={canManage ? 7 : 6} className="admin-table-message">No guests match these filters.</td></tr> : null}
        </tbody></table></div>
      )}

      {editorOpen ? <div className="admin-editor-backdrop"><section className="admin-guest-editor" aria-labelledby="guest-editor-title"><div className="admin-editor-header"><div><p className="admin-status-label">{editingGuest ? "Edit invitation" : "New invitation"}</p><h2 id="guest-editor-title">{editingGuest ? editingGuest.full_name : "Add guest"}</h2></div><button type="button" onClick={closeEditor}>Close</button></div><form onSubmit={saveGuest}>
        <label>Invitation code<input value={draft.invitation_code} onChange={(e) => setDraft({...draft, invitation_code:e.target.value.toUpperCase()})} disabled={Boolean(editingGuest)} minLength={4} required /></label>
        <div className="admin-form-grid"><label>First name<input value={draft.first_name} onChange={(e) => setDraft({...draft, first_name:e.target.value})} required /></label><label>Middle name<input value={draft.middle_name} onChange={(e) => setDraft({...draft, middle_name:e.target.value})} /></label><label>Last name<input value={draft.last_name} onChange={(e) => setDraft({...draft, last_name:e.target.value})} required /></label><label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({...draft, email:e.target.value})} /></label><label>Phone<input value={draft.phone_number} onChange={(e) => setDraft({...draft, phone_number:e.target.value})} /></label><label>Household<input value={draft.household_name} onChange={(e) => setDraft({...draft, household_name:e.target.value})} /></label><label>Companion allowance<input type="number" min="0" max="20" value={draft.maximum_companions} onChange={(e) => setDraft({...draft, maximum_companions:e.target.value})} required /></label><label>Age group<select value={draft.age_group} onChange={(e) => setDraft({...draft, age_group:e.target.value as AgeGroup})}><option value="adult">Adult</option><option value="child">Child</option></select></label>{editingGuest ? <label>Guest status<select value={draft.status} onChange={(e) => setDraft({...draft, status:e.target.value as GuestStatus})}><option value="invited">Invited</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label> : null}</div>
        <label className="admin-checkbox"><input type="checkbox" checked={draft.is_primary_guest} onChange={(e) => setDraft({...draft, is_primary_guest:e.target.checked})} />Primary guest</label>
        <div className="admin-editor-actions"><button type="button" onClick={closeEditor}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save guest"}</button></div>
      </form></section></div> : null}
    </section>
  );
}
