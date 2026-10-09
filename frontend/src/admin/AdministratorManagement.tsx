import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import {
  createAdministratorAccount,
  listAdministratorAccounts,
  resetAdministratorPassword,
  updateAdministratorAccount,
} from "./api";
import type {
  AdminAccount,
  AdminAccountCreate,
  AdminAccountStatus,
  AdminAccountUpdate,
  AdminRole,
} from "./types";

type AccountDraft = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  status: AdminAccountStatus;
  temporary_password: string;
};

function emptyDraft(): AccountDraft {
  return {
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "admin",
    status: "active",
    temporary_password: "",
  };
}

export function AdministratorManagement({
  accessToken,
  currentAdministratorId,
}: {
  accessToken: string;
  currentAdministratorId: number;
}) {
  const [administrators, setAdministrators] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminAccountStatus | "all">("all");
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [resettingAccount, setResettingAccount] = useState<AdminAccount | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listAdministratorAccounts(accessToken)
      .then((response) => {
        if (!active) return;
        setAdministrators(response.administrators);
        setErrorMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "Administrator accounts could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, reloadKey]);

  const filteredAdministrators = useMemo(() => {
    const query = search.trim().toLowerCase();
    return administrators.filter((administrator) => {
      const matchesSearch =
        !query ||
        [administrator.full_name, administrator.username, administrator.email]
          .some((value) => value.toLowerCase().includes(query));
      return matchesSearch &&
        (statusFilter === "all" || administrator.status === statusFilter);
    });
  }, [administrators, search, statusFilter]);

  function openCreate(): void {
    setDraft(emptyDraft());
    setEditingAccount(null);
    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEdit(administrator: AdminAccount): void {
    setDraft({
      username: administrator.username,
      email: administrator.email,
      first_name: administrator.first_name,
      last_name: administrator.last_name,
      role: administrator.role,
      status: administrator.status,
      temporary_password: "",
    });
    setEditingAccount(administrator);
    setIsCreating(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeEditor(): void {
    setEditingAccount(null);
    setIsCreating(false);
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    try {
      if (editingAccount) {
        const update: AdminAccountUpdate = {
          email: draft.email.trim(),
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          role: draft.role,
          status: draft.status,
        };
        const response = await updateAdministratorAccount(
          accessToken,
          editingAccount.id,
          update,
        );
        setSuccessMessage(response.message);
      } else {
        const account: AdminAccountCreate = {
          username: draft.username.trim(),
          email: draft.email.trim(),
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          role: draft.role,
          temporary_password: draft.temporary_password,
        };
        const response = await createAdministratorAccount(accessToken, account);
        setSuccessMessage(response.message);
      }
      closeEditor();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "The administrator could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openPasswordReset(administrator: AdminAccount): void {
    setResettingAccount(administrator);
    setTemporaryPassword("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveTemporaryPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!resettingAccount) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const response = await resetAdministratorPassword(
        accessToken,
        resettingAccount.id,
        temporaryPassword,
      );
      setSuccessMessage(response.message);
      setResettingAccount(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "The password could not be reset.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="admin-guests admin-administrators" aria-labelledby="administrators-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-status-label">Phase 7</p>
          <h2 id="administrators-title">Administrator accounts</h2>
          <p>{administrators.length} accounts with dashboard access</p>
        </div>
        <button type="button" onClick={openCreate}>Add administrator</button>
      </div>

      <div className="admin-guest-filters admin-administrator-filters">
        <input
          aria-label="Search administrators"
          placeholder="Search name, username, or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter administrator status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as AdminAccountStatus | "all")}
        >
          <option value="all">All account statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="admin-success" role="status">{successMessage}</p> : null}
      {isLoading ? <p className="admin-table-message">Loading administrator accounts...</p> : (
        <div className="admin-table-wrap">
          <table className="admin-guest-table admin-administrator-table">
            <thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Password</th><th>Last sign in</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredAdministrators.map((administrator) => {
                const isCurrent = administrator.id === currentAdministratorId;
                return (
                  <tr key={administrator.id}>
                    <td><strong>{administrator.full_name}{isCurrent ? " (You)" : ""}</strong><small>@{administrator.username} · {administrator.email}</small></td>
                    <td><span className="admin-status-pill">{roleLabel(administrator.role)}</span></td>
                    <td><span className={`admin-status-pill is-${administrator.status}`}>{statusLabel(administrator.status)}</span></td>
                    <td>{administrator.is_password_change_required ? "Change required" : "Current"}{administrator.locked_until ? <small>Temporarily locked</small> : null}</td>
                    <td>{administrator.last_login_at ? formatDate(administrator.last_login_at) : "Never"}</td>
                    <td><div className="admin-row-actions"><button type="button" onClick={() => openEdit(administrator)}>Edit</button>{!isCurrent ? <button type="button" onClick={() => openPasswordReset(administrator)}>Reset password</button> : null}</div></td>
                  </tr>
                );
              })}
              {!filteredAdministrators.length ? <tr><td colSpan={6} className="admin-table-message">No administrator accounts match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}

      {isCreating || editingAccount ? (
        <div className="admin-editor-backdrop">
          <section className="admin-guest-editor" aria-labelledby="administrator-editor-title">
            <div className="admin-editor-header">
              <div><p className="admin-status-label">{editingAccount ? "Edit account" : "New account"}</p><h2 id="administrator-editor-title">{editingAccount?.full_name ?? "Add administrator"}</h2></div>
              <button type="button" onClick={closeEditor}>Close</button>
            </div>
            <form onSubmit={saveAccount}>
              <div className="admin-form-grid">
                <label>First name<input value={draft.first_name} onChange={(event) => setDraft({...draft, first_name:event.target.value})} required /></label>
                <label>Last name<input value={draft.last_name} onChange={(event) => setDraft({...draft, last_name:event.target.value})} required /></label>
                <label>Username<input value={draft.username} onChange={(event) => setDraft({...draft, username:event.target.value})} disabled={Boolean(editingAccount)} minLength={3} pattern="[A-Za-z0-9._-]+" required /></label>
                <label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({...draft, email:event.target.value})} required /></label>
                <label>Role<select value={draft.role} onChange={(event) => setDraft({...draft, role:event.target.value as AdminRole})} disabled={editingAccount?.id === currentAdministratorId}><option value="super_admin">Super Admin</option><option value="admin">Manager</option><option value="viewer">Viewer</option></select></label>
                {editingAccount ? <label>Status<select value={draft.status} onChange={(event) => setDraft({...draft, status:event.target.value as AdminAccountStatus})} disabled={editingAccount.id === currentAdministratorId}><option value="active">Active</option><option value="disabled">Disabled</option></select></label> : <label>Temporary password<input type="password" autoComplete="new-password" value={draft.temporary_password} onChange={(event) => setDraft({...draft, temporary_password:event.target.value})} minLength={12} maxLength={128} required /></label>}
              </div>
              {!editingAccount ? <small>The administrator must change this temporary password after signing in.</small> : null}
              {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
              <div className="admin-editor-actions"><button type="button" onClick={closeEditor}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save administrator"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {resettingAccount ? (
        <div className="admin-editor-backdrop">
          <section className="admin-guest-editor admin-password-reset" aria-labelledby="password-reset-title">
            <div className="admin-editor-header"><div><p className="admin-status-label">Reset password</p><h2 id="password-reset-title">{resettingAccount.full_name}</h2></div><button type="button" onClick={() => setResettingAccount(null)}>Close</button></div>
            <form onSubmit={saveTemporaryPassword}>
              <label>New temporary password<input type="password" autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
              <small>The existing sessions will expire and a password change will be required.</small>
              {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
              <div className="admin-editor-actions"><button type="button" onClick={() => setResettingAccount(null)}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Reset password"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function roleLabel(role: AdminRole): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Manager";
  return "Viewer";
}

function statusLabel(status: AdminAccountStatus): string {
  return status === "active" ? "Active" : "Disabled";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
