import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import {
  exportAdministratorRsvps,
  listAdministratorRsvps,
  saveAdministratorRsvp,
} from "./api";
import type {
  AdminCompanion,
  AdminRole,
  AdminRSVP,
  AttendanceType,
  MealPreference,
  RSVPInput,
  RSVPStatus,
} from "./types";

type CompanionDraft = Omit<AdminCompanion, "middle_name" | "meal_preference" | "dietary_restrictions"> & {
  middle_name: string;
  meal_preference: MealPreference | "";
  dietary_restrictions: string;
};

type RSVPDraft = {
  status: RSVPStatus;
  attendance_type: AttendanceType | "";
  meal_preference: MealPreference | "";
  dietary_restrictions: string;
  guest_message: string;
  companions: CompanionDraft[];
};

const emptyCompanion = (): CompanionDraft => ({
  first_name: "", middle_name: "", last_name: "", meal_preference: "", dietary_restrictions: "",
});

function label(value: string | null): string {
  if (!value) return "Not provided";
  if (value === "not_attending") return "Declined";
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function draftFromRsvp(rsvp: AdminRSVP): RSVPDraft {
  return {
    status: rsvp.rsvp_id ? rsvp.status : "attending",
    attendance_type: rsvp.attendance_type ?? "ceremony_and_reception",
    meal_preference: rsvp.meal_preference ?? "",
    dietary_restrictions: rsvp.dietary_restrictions ?? "",
    guest_message: rsvp.guest_message ?? "",
    companions: rsvp.companions.map((companion) => ({
      first_name: companion.first_name,
      middle_name: companion.middle_name ?? "",
      last_name: companion.last_name,
      meal_preference: companion.meal_preference ?? "",
      dietary_restrictions: companion.dietary_restrictions ?? "",
    })),
  };
}

export function RSVPManagement({ accessToken, role }: { accessToken: string; role: AdminRole }) {
  const [rsvps, setRsvps] = useState<AdminRSVP[]>([]);
  const [selected, setSelected] = useState<AdminRSVP | null>(null);
  const [draft, setDraft] = useState<RSVPDraft | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RSVPStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const canManage = role !== "viewer";

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listAdministratorRsvps(accessToken)
      .then((response) => { if (active) { setRsvps(response.rsvps); setErrorMessage(""); } })
      .catch((error) => { if (active) setErrorMessage(error instanceof ApiError ? error.message : "RSVPs could not be loaded."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, reloadKey]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rsvps.filter((rsvp) => {
      const matchesSearch = !query || [rsvp.guest_name, rsvp.invitation_code, rsvp.household_name]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (statusFilter === "all" || rsvp.status === statusFilter);
    });
  }, [rsvps, search, statusFilter]);

  function openEditor(rsvp: AdminRSVP): void {
    setSelected(rsvp);
    setDraft(draftFromRsvp(rsvp));
    setErrorMessage("");
  }

  function closeEditor(): void { setSelected(null); setDraft(null); }

  function setStatus(status: RSVPStatus): void {
    if (!draft) return;
    setDraft({
      ...draft,
      status,
      attendance_type: status === "attending" ? (draft.attendance_type || "ceremony_and_reception") : "",
      meal_preference: status === "attending" ? draft.meal_preference : "",
      dietary_restrictions: status === "attending" ? draft.dietary_restrictions : "",
      companions: status === "attending" ? draft.companions : [],
    });
  }

  function updateCompanion(index: number, changes: Partial<CompanionDraft>): void {
    if (!draft) return;
    setDraft({ ...draft, companions: draft.companions.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !draft) return;
    setIsSaving(true);
    setErrorMessage("");
    const input: RSVPInput = {
      status: draft.status,
      attendance_type: draft.status === "attending" ? draft.attendance_type as AttendanceType : null,
      meal_preference: draft.status === "attending" && draft.meal_preference ? draft.meal_preference : null,
      dietary_restrictions: draft.status === "attending" ? draft.dietary_restrictions.trim() || null : null,
      guest_message: draft.guest_message.trim() || null,
      companions: draft.status === "attending" ? draft.companions.map((companion) => ({
        first_name: companion.first_name.trim(),
        middle_name: companion.middle_name.trim() || null,
        last_name: companion.last_name.trim(),
        meal_preference: companion.meal_preference || null,
        dietary_restrictions: companion.dietary_restrictions.trim() || null,
      })) : [],
    };
    try {
      await saveAdministratorRsvp(accessToken, selected.guest_id, input);
      closeEditor();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The RSVP could not be saved.");
    } finally { setIsSaving(false); }
  }

  async function exportCsv(): Promise<void> {
    setIsExporting(true);
    setErrorMessage("");
    try {
      const blob = await exportAdministratorRsvps(accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "wedding-rsvps.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The export could not be downloaded.");
    } finally { setIsExporting(false); }
  }

  return (
    <section className="admin-guests admin-rsvps" aria-labelledby="rsvp-management-title">
      <div className="admin-section-heading">
        <div><p className="admin-status-label">Phase 4</p><h2 id="rsvp-management-title">RSVP management</h2><p>{rsvps.filter((item) => item.status !== "pending").length} responses across {rsvps.length} invitations</p></div>
        <button type="button" onClick={() => void exportCsv()} disabled={isExporting}>{isExporting ? "Exporting..." : "Export CSV"}</button>
      </div>
      <div className="admin-guest-filters admin-rsvp-filters">
        <input aria-label="Search RSVPs" placeholder="Search guest, code, or household" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter RSVP status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RSVPStatus | "all")}><option value="all">All RSVP statuses</option><option value="pending">Pending</option><option value="attending">Attending</option><option value="not_attending">Declined</option></select>
      </div>
      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {isLoading ? <p className="admin-table-message">Loading RSVPs...</p> : (
        <div className="admin-table-wrap"><table className="admin-guest-table admin-rsvp-table"><thead><tr><th>Guest</th><th>Status</th><th>Attendance</th><th>Companions</th><th>Meal</th><th>Responded</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((rsvp) => <tr key={rsvp.guest_id}><td><strong>{rsvp.guest_name}</strong><small>{rsvp.household_name || rsvp.invitation_code}</small></td><td><span className={`admin-status-pill is-${rsvp.status}`}>{label(rsvp.status)}</span></td><td>{label(rsvp.attendance_type)}</td><td>{rsvp.companion_count} / {rsvp.maximum_companions}</td><td>{label(rsvp.meal_preference)}</td><td>{rsvp.responded_at ? new Date(rsvp.responded_at).toLocaleDateString() : "Awaiting response"}</td><td><div className="admin-row-actions"><button type="button" onClick={() => openEditor(rsvp)}>{canManage ? (rsvp.rsvp_id ? "Edit" : "Add RSVP") : "View"}</button></div></td></tr>)}
          {filtered.length === 0 ? <tr><td colSpan={7} className="admin-table-message">No RSVPs match these filters.</td></tr> : null}
        </tbody></table></div>
      )}

      {selected && draft ? <div className="admin-editor-backdrop"><section className="admin-guest-editor admin-rsvp-editor" aria-labelledby="rsvp-editor-title"><div className="admin-editor-header"><div><p className="admin-status-label">{selected.rsvp_id ? "RSVP details" : "Manual RSVP"}</p><h2 id="rsvp-editor-title">{selected.guest_name}</h2><p>{selected.invitation_code} · Up to {selected.maximum_companions} companions</p></div><button type="button" onClick={closeEditor}>Close</button></div><form onSubmit={save}>
        <div className="admin-form-grid"><label>RSVP status<select value={draft.status} onChange={(event) => setStatus(event.target.value as RSVPStatus)} disabled={!canManage}><option value="pending">Pending</option><option value="attending">Attending</option><option value="not_attending">Declined</option></select></label>{draft.status === "attending" ? <><label>Attendance<select value={draft.attendance_type} onChange={(event) => setDraft({...draft, attendance_type:event.target.value as AttendanceType})} disabled={!canManage} required><option value="ceremony_and_reception">Ceremony and reception</option><option value="ceremony_only">Ceremony only</option><option value="reception_only">Reception only</option></select></label><label>Guest meal<select value={draft.meal_preference} onChange={(event) => setDraft({...draft, meal_preference:event.target.value as MealPreference | ""})} disabled={!canManage}><option value="">Not provided</option><option value="standard">Standard</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="halal">Halal</option><option value="other">Other</option></select></label><label>Dietary restrictions<input value={draft.dietary_restrictions} onChange={(event) => setDraft({...draft, dietary_restrictions:event.target.value})} disabled={!canManage} /></label></> : null}</div>
        <label className="admin-rsvp-message">Guest message<textarea rows={3} value={draft.guest_message} onChange={(event) => setDraft({...draft, guest_message:event.target.value})} disabled={!canManage} /></label>
        {draft.status === "attending" ? <div className="admin-companions"><div className="admin-companion-heading"><h3>Companions</h3>{canManage && draft.companions.length < selected.maximum_companions ? <button type="button" onClick={() => setDraft({...draft, companions:[...draft.companions, emptyCompanion()]})}>Add companion</button> : null}</div>{draft.companions.map((companion, index) => <fieldset key={index}><legend>Companion {index + 1}</legend><div className="admin-form-grid"><label>First name<input value={companion.first_name} onChange={(event) => updateCompanion(index, {first_name:event.target.value})} disabled={!canManage} required /></label><label>Middle name<input value={companion.middle_name} onChange={(event) => updateCompanion(index, {middle_name:event.target.value})} disabled={!canManage} /></label><label>Last name<input value={companion.last_name} onChange={(event) => updateCompanion(index, {last_name:event.target.value})} disabled={!canManage} required /></label><label>Meal<select value={companion.meal_preference} onChange={(event) => updateCompanion(index, {meal_preference:event.target.value as MealPreference | ""})} disabled={!canManage}><option value="">Not provided</option><option value="standard">Standard</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="halal">Halal</option><option value="other">Other</option></select></label></div>{canManage ? <button className="admin-remove-companion" type="button" onClick={() => setDraft({...draft, companions:draft.companions.filter((_, itemIndex) => itemIndex !== index)})}>Remove companion</button> : null}</fieldset>)}</div> : null}
        <div className="admin-editor-actions"><button type="button" onClick={closeEditor}>{canManage ? "Cancel" : "Close"}</button>{canManage ? <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save RSVP"}</button> : null}</div>
      </form></section></div> : null}
    </section>
  );
}
