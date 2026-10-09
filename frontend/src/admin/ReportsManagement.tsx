import { useEffect, useState } from "react";

import { ApiError } from "../lib/api";
import { exportAdministratorReport, getAdministratorReports } from "./api";
import type { AdminReportSummary, ReportBreakdownItem } from "./types";

export function ReportsManagement({ accessToken }: { accessToken: string }) {
  const [report, setReport] = useState<AdminReportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let active = true;
    getAdministratorReports(accessToken)
      .then((response) => {
        if (active) {
          setReport(response);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(
            error instanceof ApiError ? error.message : "Reports could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function exportCsv() {
    setIsExporting(true);
    setErrorMessage("");
    try {
      const blob = await exportAdministratorReport(accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "wedding-management-report.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "The report could not be downloaded.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  const overviewCards = report
    ? [
        ["Invitations", report.total_invitations],
        ["Response rate", `${report.response_rate}%`],
        ["Attending people", report.attending_people],
        ["Pending invitations", report.pending_invitations],
        ["Ceremony guests", report.ceremony_people],
        ["Reception guests", report.reception_people],
        ["Companions", report.companions_attending],
        ["Dietary requests", report.dietary_requests],
      ]
    : [];

  return (
    <section className="admin-guests admin-reports" aria-labelledby="reports-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-status-label">Phase 6</p>
          <h2 id="reports-title">Reports</h2>
          <p>Live planning totals from invitations, RSVPs, meals, and seating.</p>
        </div>
        <button type="button" onClick={() => void exportCsv()} disabled={isExporting || !report}>
          {isExporting ? "Exporting..." : "Export full CSV"}
        </button>
      </div>

      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {!report && !errorMessage ? <p className="admin-table-message">Loading reports...</p> : null}

      {report ? (
        <>
          <div className="admin-report-cards">
            {overviewCards.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <section className="admin-report-progress" aria-labelledby="planning-progress-title">
            <div className="admin-subsection-heading">
              <h3 id="planning-progress-title">Planning readiness</h3>
              <span>Updates automatically</span>
            </div>
            <ProgressRow label="RSVP responses" value={report.responded_invitations} total={report.total_invitations} percentage={report.response_rate} />
            <ProgressRow label="Reception seating" value={report.assigned_reception_people} total={report.reception_people} percentage={report.seating_completion_rate} />
            {report.unassigned_reception_people > 0 ? (
              <p className="admin-report-callout">
                {report.unassigned_reception_people} reception {report.unassigned_reception_people === 1 ? "guest still needs" : "guests still need"} a table assignment.
              </p>
            ) : null}
          </section>

          <div className="admin-report-breakdowns">
            <Breakdown title="Attendance" items={report.attendance_breakdown} />
            <Breakdown title="Meal preferences" items={report.meal_breakdown} />
            <Breakdown title="Invited age groups" items={report.age_breakdown} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function ProgressRow({ label, value, total, percentage }: { label: string; value: number; total: number; percentage: number }) {
  return (
    <div className="admin-report-progress-row">
      <div><strong>{label}</strong><span>{value} of {total}</span></div>
      <div className="admin-report-track"><span style={{ width: `${Math.min(100, percentage)}%` }} /></div>
      <b>{percentage}%</b>
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: ReportBreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="admin-report-breakdown">
      <h3>{title}</h3>
      {items.length ? items.map((item) => (
        <div key={item.label}>
          <span>{friendlyLabel(item.label)}</span>
          <strong>{item.value}</strong>
          <small>{total ? Math.round((item.value / total) * 100) : 0}%</small>
        </div>
      )) : <p>No data yet.</p>}
    </section>
  );
}

function friendlyLabel(value: string): string {
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
