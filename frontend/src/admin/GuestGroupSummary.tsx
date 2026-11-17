import { useMemo } from "react";

import { guestGroups } from "./guestGroups";
import type { AdminRSVP } from "./types";

type GroupCounts = {
  invitations: number;
  seats: number;
  attendees: number;
  pending: number;
  declined: number;
};

const emptyCounts = (): GroupCounts => ({
  invitations: 0,
  seats: 0,
  attendees: 0,
  pending: 0,
  declined: 0,
});

const sideGroups = [
  {
    name: "Groom's Side",
    groups: [
      "John Paul's Family",
      "John Paul's Friends",
      "John Paul's Workmates",
    ],
  },
  {
    name: "Bride's Side",
    groups: ["Joyce's Family", "Joyce's Friends", "Joyce's Workmates"],
  },
  { name: "Entourage", groups: ["Wedding Entourage", "Principal Sponsors"] },
];

function sumCounts(rows: { counts: GroupCounts }[]): GroupCounts {
  const total = emptyCounts();
  for (const row of rows) {
    for (const key of Object.keys(total) as (keyof GroupCounts)[])
      total[key] += row.counts[key];
  }
  return total;
}

export function GuestGroupSummary({ rsvps }: { rsvps: AdminRSVP[] }) {
  const { sections, total } = useMemo(() => {
    const counts = new Map<string, GroupCounts>(
      guestGroups.map((group) => [group, emptyCounts()]),
    );
    for (const rsvp of rsvps) {
      const group = rsvp.household_name?.trim() || "";
      const row = counts.get(group) ?? emptyCounts();
      row.invitations += 1;
      row.seats += 1 + rsvp.maximum_companions;
      row.attendees +=
        rsvp.status === "attending" ? 1 + rsvp.companion_count : 0;
      row.pending += rsvp.status === "pending" ? 1 : 0;
      row.declined += rsvp.status === "not_attending" ? 1 : 0;
      counts.set(group, row);
    }
    // Include custom groups and unassigned records instead of dropping them.
    const known = new Set<string>(guestGroups);
    const custom = [...counts.keys()]
      .filter((group) => group && !known.has(group))
      .sort((a, b) => a.localeCompare(b));
    const groups = [...guestGroups, ...custom, ""].map((name) => ({
      name,
      counts: counts.get(name) ?? emptyCounts(),
    }));
    const assigned = new Set(sideGroups.flatMap((side) => side.groups));
    const sections = [
      ...sideGroups.map((side) => ({
        name: side.name,
        groups: groups.filter((group) => side.groups.includes(group.name)),
      })),
      {
        name: "Others",
        groups: groups.filter((group) => !assigned.has(group.name)),
      },
    ].map((section) => ({ ...section, subtotal: sumCounts(section.groups) }));
    return { sections, total: sumCounts(groups) };
  }, [rsvps]);

  function cells(counts: GroupCounts) {
    return (
      <>
        <td>{counts.invitations}</td>
        <td>{counts.seats}</td>
        <td>{counts.attendees}</td>
        <td>{counts.pending}</td>
        <td>{counts.declined}</td>
      </>
    );
  }

  return (
    <section
      className="admin-content-card admin-rsvp-summary"
      aria-labelledby="guest-group-summary-title"
    >
      <h3 id="guest-group-summary-title">Guest Group Summary</h3>
      <p className="admin-content-help">
        Overall totals across all invitations, unaffected by the filters below.
        Invitations count guest records; allocated seats include companion
        allowances. Confirmed attendees count attending guests plus confirmed
        companions. Pending and declined count invitations.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-guest-table" aria-label="Guest group counts">
          <thead>
            <tr>
              <th scope="col">Guest group</th>
              <th scope="col">Invitations</th>
              <th scope="col">Allocated seats</th>
              <th scope="col">Confirmed attendees</th>
              <th scope="col">Pending responses</th>
              <th scope="col">Declined responses</th>
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.name} aria-label={section.name}>
              <tr className="admin-summary-section">
                <th scope="rowgroup" colSpan={6}>
                  {section.name}
                </th>
              </tr>
              {section.groups.map((group) => (
                <tr key={group.name}>
                  <th scope="row">{group.name || "Unassigned"}</th>
                  {cells(group.counts)}
                </tr>
              ))}
              <tr className="admin-summary-subtotal">
                <th scope="row">{section.name} subtotal</th>
                {cells(section.subtotal)}
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row">Overall total</th>
              {cells(total)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
