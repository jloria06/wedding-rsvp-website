import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import {
  assignAdministratorParty,
  createAdministratorTable,
  deleteAdministratorTable,
  getAdministratorSeating,
  unassignAdministratorParty,
  updateAdministratorTable,
} from "./api";
import type { AdminRole, SeatingOverview, SeatingTable } from "./types";

type TableDraft = { name: string; capacity: string; notes: string };
const emptyDraft: TableDraft = { name: "", capacity: "8", notes: "" };

export function SeatingManagement({
  accessToken,
  role,
}: {
  accessToken: string;
  role: AdminRole;
}) {
  const [seating, setSeating] = useState<SeatingOverview | null>(null);
  const [draft, setDraft] = useState<TableDraft>(emptyDraft);
  const [editingTable, setEditingTable] = useState<SeatingTable | null>(null);
  const [selectedTables, setSelectedTables] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const canManage = role !== "viewer";

  useEffect(() => {
    let active = true;
    getAdministratorSeating(accessToken)
      .then((response) => {
        if (active) setSeating(response);
      })
      .catch((error) => {
        if (active) setErrorMessage(messageFor(error, "Seating could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const unassignedParties = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return seating?.unassigned_parties ?? [];
    return (seating?.unassigned_parties ?? []).filter((party) =>
      [party.guest_name, party.invitation_code, party.household_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, seating]);

  async function saveTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const capacity = Number(draft.capacity);
    if (!draft.name.trim() || !Number.isInteger(capacity) || capacity < 1) {
      setErrorMessage("Enter a table name and a capacity of at least one.");
      return;
    }
    try {
      await mutate(async () =>
        editingTable
          ? updateAdministratorTable(accessToken, editingTable.id, {
              name: draft.name.trim(),
              capacity,
              notes: draft.notes.trim() || null,
            })
          : createAdministratorTable(accessToken, {
              name: draft.name.trim(),
              capacity,
              notes: draft.notes.trim() || null,
            }),
      );
      setEditingTable(null);
      setDraft(emptyDraft);
    } catch {
      // The mutation displays the API error.
    }
  }

  async function mutate(action: () => ReturnType<typeof createAdministratorTable>) {
    setIsBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await action();
      setSeating(response.seating);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(messageFor(error, "The seating change could not be saved."));
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  function beginEdit(table: SeatingTable) {
    setEditingTable(table);
    setDraft({
      name: table.name,
      capacity: String(table.capacity),
      notes: table.notes ?? "",
    });
  }

  async function assign(guestId: number) {
    const tableId = Number(selectedTables[guestId]);
    if (!tableId) {
      setErrorMessage("Choose a table before assigning this party.");
      return;
    }
    try {
      await mutate(() => assignAdministratorParty(accessToken, guestId, tableId));
      setSelectedTables((current) => ({ ...current, [guestId]: "" }));
    } catch {
      // The mutation displays the API error.
    }
  }

  return (
    <section className="admin-guests admin-seating" aria-labelledby="seating-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-status-label">Phase 6</p>
          <h2 id="seating-title">Seating management</h2>
          <p>Arrange each reception party together and monitor table capacity.</p>
        </div>
      </div>

      {seating ? (
        <div className="admin-seating-summary" aria-label="Seating summary">
          <article><span>Total capacity</span><strong>{seating.total_capacity}</strong></article>
          <article><span>Assigned seats</span><strong>{seating.assigned_seats}</strong></article>
          <article><span>Remaining seats</span><strong>{seating.remaining_seats}</strong></article>
          <article><span>Unassigned parties</span><strong>{seating.unassigned_parties.length}</strong></article>
        </div>
      ) : null}

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="admin-success" role="status">{successMessage}</p> : null}

      {canManage ? (
        <form className="admin-seating-form" onSubmit={(event) => void saveTable(event)}>
          <div>
            <h3>{editingTable ? `Edit ${editingTable.name}` : "Add reception table"}</h3>
            <p>Create the tables available at the reception.</p>
          </div>
          <label>
            Table name
            <input value={draft.name} maxLength={100} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          </label>
          <label>
            Capacity
            <input type="number" min="1" max="1000" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} required />
          </label>
          <label className="admin-seating-notes">
            Notes
            <input value={draft.notes} maxLength={500} placeholder="Optional" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
          <div className="admin-seating-form-actions">
            {editingTable ? (
              <button type="button" onClick={() => { setEditingTable(null); setDraft(emptyDraft); }}>Cancel</button>
            ) : null}
            <button type="submit" disabled={isBusy}>{editingTable ? "Save table" : "Add table"}</button>
          </div>
        </form>
      ) : null}

      <div className="admin-seating-layout">
        <section className="admin-seating-tables" aria-labelledby="tables-title">
          <div className="admin-subsection-heading">
            <h3 id="tables-title">Reception tables</h3>
            <span>{seating?.tables.length ?? 0} tables</span>
          </div>
          {!seating ? <p className="admin-table-message">Loading seating...</p> : null}
          {seating?.tables.length === 0 ? <p className="admin-table-message">Add your first reception table to begin.</p> : null}
          {seating?.tables.map((table) => (
            <article className="admin-seating-table-card" key={table.id}>
              <header>
                <div>
                  <h4>{table.name}</h4>
                  {table.notes ? <p>{table.notes}</p> : null}
                </div>
                <span className={table.remaining_seats < 0 ? "is-over" : ""}>
                  {table.assigned_seats} / {table.capacity} seats
                </span>
              </header>
              <div className="admin-capacity-track" aria-label={`${table.remaining_seats} seats remaining`}>
                <span style={{ width: `${Math.min(100, (table.assigned_seats / table.capacity) * 100)}%` }} />
              </div>
              {table.assignments.length ? (
                <ul className="admin-seating-assignment-list">
                  {table.assignments.map((party) => (
                    <li key={party.assignment_id}>
                      <div>
                        <strong>{party.guest_name}</strong>
                        <small>{party.party_size} {party.party_size === 1 ? "seat" : "seats"}{party.companion_names.length ? ` · ${party.companion_names.join(", ")}` : ""}</small>
                      </div>
                      {canManage ? <button type="button" disabled={isBusy} onClick={() => void mutate(() => unassignAdministratorParty(accessToken, party.guest_id)).catch(() => undefined)}>Remove</button> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="admin-seating-empty">No parties assigned yet.</p>}
              {canManage ? (
                <footer>
                  <button type="button" onClick={() => beginEdit(table)}>Edit</button>
                  <button type="button" className="is-danger" disabled={isBusy || table.assignments.length > 0} onClick={() => void mutate(() => deleteAdministratorTable(accessToken, table.id)).catch(() => undefined)}>Delete</button>
                </footer>
              ) : null}
            </article>
          ))}
        </section>

        <section className="admin-seating-unassigned" aria-labelledby="unassigned-title">
          <div className="admin-subsection-heading">
            <h3 id="unassigned-title">Unassigned parties</h3>
            <span>{seating?.unassigned_parties.length ?? 0} parties</span>
          </div>
          <input className="admin-seating-search" type="search" placeholder="Search guest, code, or household" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="admin-unassigned-list">
            {unassignedParties.map((party) => (
              <article key={party.guest_id}>
                <div>
                  <strong>{party.guest_name}</strong>
                  <small>{party.household_name || party.invitation_code} · {party.party_size} {party.party_size === 1 ? "seat" : "seats"}</small>
                  {party.companion_names.length ? <p>With {party.companion_names.join(", ")}</p> : null}
                </div>
                {canManage ? (
                  <div className="admin-assign-controls">
                    <select aria-label={`Table for ${party.guest_name}`} value={selectedTables[party.guest_id] ?? ""} onChange={(event) => setSelectedTables({ ...selectedTables, [party.guest_id]: event.target.value })}>
                      <option value="">Choose table</option>
                      {seating?.tables.filter((table) => table.remaining_seats >= party.party_size).map((table) => (
                        <option key={table.id} value={table.id}>{table.name} ({table.remaining_seats} open)</option>
                      ))}
                    </select>
                    <button type="button" disabled={isBusy || !selectedTables[party.guest_id]} onClick={() => void assign(party.guest_id)}>Assign</button>
                  </div>
                ) : null}
              </article>
            ))}
            {seating && unassignedParties.length === 0 ? <p className="admin-table-message">All reception parties are assigned.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
