import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "../lib/api";
import { getAdministratorAuditLogs } from "./api";
import type { AdminAuditLog } from "./types";

export function AuditLogsManagement({ accessToken }: { accessToken: string }) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [resourceType, setResourceType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await getAdministratorAuditLogs(accessToken);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Audit logs could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const actions = useMemo(
    () => [...new Set(logs.map((entry) => entry.action))].sort(),
    [logs],
  );
  const resourceTypes = useMemo(
    () => [...new Set(logs.map((entry) => entry.resource_type))].sort(),
    [logs],
  );
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((entry) => {
      const matchesSearch =
        !query ||
        entry.summary.toLowerCase().includes(query) ||
        entry.administrator_name.toLowerCase().includes(query) ||
        entry.administrator_username.toLowerCase().includes(query) ||
        entry.resource_id?.toLowerCase().includes(query);
      return (
        matchesSearch &&
        (action === "all" || entry.action === action) &&
        (resourceType === "all" || entry.resource_type === resourceType)
      );
    });
  }, [action, logs, resourceType, search]);

  return (
    <section className="admin-guests admin-audit" aria-labelledby="audit-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-status-label">Phase 6</p>
          <h2 id="audit-title">Administrator audit logs</h2>
          <p>
            {logs.length} recent entries{total > logs.length ? ` of ${total}` : ""} across
            guests, RSVPs, seating, and website content.
          </p>
        </div>
        <button type="button" onClick={() => void loadLogs()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh logs"}
        </button>
      </div>

      <div className="admin-audit-filters">
        <input
          aria-label="Search audit logs"
          placeholder="Search administrator, summary, or record ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter by action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value="all">All actions</option>
          {actions.map((value) => (
            <option value={value} key={value}>{friendlyLabel(value)}</option>
          ))}
        </select>
        <select
          aria-label="Filter by resource"
          value={resourceType}
          onChange={(event) => setResourceType(event.target.value)}
        >
          <option value="all">All record types</option>
          {resourceTypes.map((value) => (
            <option value={value} key={value}>{friendlyLabel(value)}</option>
          ))}
        </select>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {isLoading && !logs.length ? (
        <p className="admin-table-message">Loading administrator activity...</p>
      ) : null}

      {!isLoading || logs.length ? (
        <div className="admin-table-wrapper">
          <table className="admin-guest-table admin-audit-table">
            <thead>
              <tr>
                <th>Date and time</th>
                <th>Administrator</th>
                <th>Action</th>
                <th>Record</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <tr key={entry.id}>
                  <td className="admin-audit-date">{formatDate(entry.created_at)}</td>
                  <td>
                    <strong>{entry.administrator_name}</strong>
                    <small>@{entry.administrator_username} · {friendlyLabel(entry.administrator_role)}</small>
                  </td>
                  <td><span className="admin-status-pill">{friendlyLabel(entry.action)}</span></td>
                  <td>
                    <strong>{friendlyLabel(entry.resource_type)}</strong>
                    <small>{entry.resource_id ? `ID ${entry.resource_id}` : "General"}</small>
                  </td>
                  <td>
                    <strong>{entry.summary}</strong>
                    {entry.details ? <small>{formatDetails(entry.details)}</small> : null}
                  </td>
                </tr>
              ))}
              {!filteredLogs.length ? (
                <tr><td colSpan={5} className="admin-table-message">No audit entries match these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function friendlyLabel(value: string): string {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([key, value]) => {
      const displayed = Array.isArray(value) ? value.join(", ") : String(value);
      return `${friendlyLabel(key)}: ${displayed}`;
    })
    .join(" · ");
}
