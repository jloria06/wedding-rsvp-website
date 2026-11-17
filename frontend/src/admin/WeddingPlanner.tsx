import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ApiError } from "../lib/api";
import type { AdminRole } from "./types";
import { loadPlanner, savePlanner } from "./plannerApi";
import {
  reviewPlannerWorkbook,
  type PlannerImportReview,
} from "./plannerImport";
import {
  displayDate,
  manilaToday,
  money,
  moneyInput,
  parseMoney,
  validatePlannerDraft,
  type PlannerDocument,
  type PlannerResponse,
} from "./plannerTypes";
import "./planner.css";

const tabs = [
  "Overview",
  "Budget",
  "Expenses",
  "Installments",
  "Vendors",
  "Checklist",
] as const;
type Collection =
  | "categories"
  | "expenses"
  | "payments"
  | "installments"
  | "vendors"
  | "checklist";
type Editor = {
  collection: Collection;
  id: string | null;
  values: Record<string, string>;
};
const labels: Record<Collection, string> = {
  categories: "budget category",
  expenses: "expense",
  payments: "payment",
  installments: "installment",
  vendors: "vendor",
  checklist: "task",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The planner could not be saved.";

export function WeddingPlanner({
  accessToken,
  role,
}: {
  accessToken: string;
  role: AdminRole;
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [planner, setPlanner] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<{
    collection: Collection;
    id: string;
    name: string;
  } | null>(null);
  const [review, setReview] = useState<PlannerImportReview | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const canManage = role !== "viewer";

  useEffect(() => {
    let active = true;
    loadPlanner(accessToken)
      .then((value) => {
        if (active) setPlanner(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setPlanner(await loadPlanner(accessToken));
      setConflict(false);
      setEditor(null);
      setReview(null);
      setRemoval(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function persist(document: PlannerDocument, message: string) {
    if (!planner || saving || conflict || !canManage) return false;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      validatePlannerDraft(document);
      setPlanner(await savePlanner(accessToken, planner.revision, document));
      setSuccess(message);
      return true;
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openEditor(
    collection: Collection,
    id: string | null = null,
    defaults: Record<string, string> = {},
  ) {
    const record = id
      ? planner?.document[collection].find((item) => item.id === id)
      : null;
    const values: Record<string, string> = { ...defaults };
    if (record)
      for (const [key, value] of Object.entries(record))
        values[key] = value == null ? "" : String(value);
    for (const field of ["budget", "estimate", "actual", "amount"])
      if (record && field in record)
        values[field] = moneyInput(
          (record as unknown as Record<string, number | null>)[field],
        );
    setError("");
    setEditor({ collection, id, values });
  }

  async function submitEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor || !planner) return;
    try {
      const v = editor.values;
      const id = editor.id ?? crypto.randomUUID();
      const name = (v.name ?? "").trim();
      const requiredAmount = () => {
        const amount = parseMoney(v.amount ?? "");
        if (!amount) throw new Error("Enter an amount greater than zero.");
        return amount;
      };
      let record;
      switch (editor.collection) {
        case "categories":
          record = { id, name, budget: parseMoney(v.budget ?? "") };
          break;
        case "vendors":
          record = {
            id,
            name,
            service: v.service ?? "",
            contact: v.contact ?? "",
            notes: v.notes ?? "",
          };
          break;
        case "expenses":
          record = {
            id,
            name,
            category_id: v.category_id,
            vendor_id: v.vendor_id || null,
            estimate: parseMoney(v.estimate ?? ""),
            actual: parseMoney(v.actual ?? ""),
            due_date: v.due_date || null,
            notes: v.notes ?? "",
          };
          break;
        case "installments":
          record = {
            id,
            name,
            expense_id: v.expense_id,
            amount: requiredAmount(),
            due_date: v.due_date,
          };
          break;
        case "payments":
          record = {
            id,
            expense_id: v.expense_id,
            installment_id: v.installment_id || null,
            amount: requiredAmount(),
            paid_date: v.paid_date || null,
            reference: v.reference ?? "",
            notes: v.notes ?? "",
          };
          break;
        case "checklist":
          record = {
            id,
            name,
            due_date: v.due_date || null,
            completed: v.completed === "true",
            notes: v.notes ?? "",
          };
          break;
      }
      const document = structuredClone(planner.document);
      // The server validates the distinct shape of each collection.
      (document[editor.collection] as unknown[]) = editor.id
        ? document[editor.collection].map((item) =>
            item.id === id ? record : item,
          )
        : [...document[editor.collection], record];
      if (await persist(document, `${labels[editor.collection]} saved.`))
        setEditor(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function removeRecord() {
    if (!removal || !planner) return;
    const document = structuredClone(planner.document);
    (document[removal.collection] as { id: string }[]) = document[
      removal.collection
    ].filter((item) => item.id !== removal.id);
    if (await persist(document, `${labels[removal.collection]} removed.`))
      setRemoval(null);
  }

  async function importWorkbook(file: File) {
    if (!planner) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      setReview(await reviewPlannerWorkbook(file, planner.document));
      setImportConfirmed(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmImport() {
    if (!review || !importConfirmed) return;
    const document = structuredClone(review.document);
    for (const item of review.schedules)
      if (item.include)
        document.installments.push({
          id: item.id,
          expense_id: item.expense_id,
          name: item.name,
          amount: item.amount,
          due_date: item.due_date,
        });
    if (
      await persist(
        document,
        "Reviewed workbook imported. Confirm vendors and undated payment details as needed.",
      )
    )
      setReview(null);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(tabs[next]);
    tabButtons.current[next]?.focus();
  }

  const d = planner?.document;
  const s = planner?.summary;
  const disabled = saving || conflict;
  const expenseName = (id: string) =>
    d?.expenses.find((e) => e.id === id)?.name ?? "Unknown expense";
  const installmentPaid = (id: string) =>
    d?.payments
      .filter((p) => p.installment_id === id)
      .reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const actions = (
    collection: Collection,
    id: string,
    name: string,
    mayRemove = true,
  ) =>
    canManage ? (
      <div className="admin-row-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => openEditor(collection, id)}
        >
          Edit
        </button>
        {mayRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError("");
              setRemoval({ collection, id, name });
            }}
          >
            Remove
          </button>
        )}
      </div>
    ) : null;
  const add = (collection: Collection, text: string) =>
    canManage && (
      <div className="admin-section-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            openEditor(
              collection,
              null,
              collection === "payments" ? { paid_date: manilaToday() } : {},
            )
          }
        >
          {text}
        </button>
      </div>
    );

  return (
    <section
      className="admin-guests admin-content admin-planner"
      aria-labelledby="planner-title"
    >
      <div className="admin-section-heading">
        <div>
          <h2 id="planner-title">Wedding Planner</h2>
          <p>
            Plan and manage your wedding budget, payments, vendors,
            installments, and checklist.
          </p>
        </div>
        <div className="admin-section-actions">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void reload()}
          >
            Reload planner
          </button>
          {canManage && (
            <button
              type="button"
              disabled={disabled || !d || !!d.expenses.length}
              onClick={() => uploadInput.current?.click()}
            >
              Review workbook
            </button>
          )}
        </div>
      </div>
      <input
        className="admin-hidden-input"
        aria-label="Wedding planner workbook"
        type="file"
        accept=".xlsx"
        ref={uploadInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importWorkbook(file);
          e.target.value = "";
        }}
      />
      {error && !editor && !review && !removal && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <p className="admin-capacity-warning" role="alert">
          Another session updated this planner. Your changes were not saved.
          Close this dialog and reload before editing again.
        </p>
      )}
      {success && (
        <p className="admin-import-result" role="status">
          {success}
        </p>
      )}
      {loading ? (
        <p className="admin-table-message" role="status">
          Loading wedding planner…
        </p>
      ) : !d || !s ? (
        <p className="admin-content-help">
          The planner could not be loaded. Confirm the backend migration and
          deployment have completed, then reload.
        </p>
      ) : (
        <>
          <div
            className="admin-content-tabs"
            role="tablist"
            aria-label="Wedding planner sections"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab}
                ref={(el) => {
                  tabButtons.current[index] = el;
                }}
                id={`planner-tab-${tab.toLowerCase()}`}
                type="button"
                role="tab"
                className={activeTab === tab ? "is-active" : ""}
                aria-selected={activeTab === tab}
                aria-controls="planner-panel"
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            id="planner-panel"
            role="tabpanel"
            aria-labelledby={`planner-tab-${activeTab.toLowerCase()}`}
            tabIndex={0}
            className="planner-panel"
          >
            {activeTab === "Overview" && (
              <>
                <div className="admin-report-cards">
                  {[
                    ["Estimated budget", money(s.budget)],
                    ["Forecast total cost", money(s.forecast)],
                    ["Total paid", money(s.paid)],
                    ["Outstanding balance", money(s.balance)],
                    ["Overdue payments", money(s.overdue)],
                    [
                      "Tasks completed",
                      `${d.checklist.filter((t) => t.completed).length} / ${d.checklist.length}`,
                    ],
                  ].map(([label, value]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <p className="admin-rsvp-setting-note">
                  Forecast uses agreed cost when available, otherwise the item
                  estimate. {s.unestimated} expense(s) have no cost yet;{" "}
                  {s.unbudgeted} category budget(s) are unset. Totals are
                  incomplete until those amounts are entered. Dates use
                  Asia/Manila; as of {displayDate(s.as_of)}.
                </p>
                {!d.expenses.length && (
                  <div className="admin-content-card">
                    <h3>Start your wedding plan</h3>
                    <p className="admin-content-help">
                      Review your Wedding Plan workbook to bring in expense
                      items and opening paid balances, or add an expense in
                      Expenses. Workbook import is available before expenses are
                      entered.
                    </p>
                  </div>
                )}
                <div className="planner-overview-grid">
                  <div className="admin-content-card">
                    <h3>Pending payments by month</h3>
                    <p className="admin-content-help">
                      Unpaid installments and unscheduled expense balances.
                      Undated amounts need a deadline.
                    </p>
                    <Table
                      headings={["Month", "Pending amount"]}
                      empty="No pending payments."
                    >
                      {s.monthly.map((item) => (
                        <tr key={item.month}>
                          <td>{item.month}</td>
                          <td>{money(item.amount)}</td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                  <div className="admin-content-card">
                    <h3>Upcoming and overdue payments</h3>
                    <Table
                      headings={["Expense", "Due", "Pending"]}
                      empty="No pending payments."
                    >
                      {s.due.map((item, index) => (
                        <tr key={`${item.expense_id}-${index}`}>
                          <td>
                            {item.name}
                            <small>{item.label}</small>
                          </td>
                          <td>
                            {displayDate(item.due_date)}
                            {item.due_date && item.due_date < s.as_of && (
                              <small className="planner-overdue">Overdue</small>
                            )}
                          </td>
                          <td>{money(item.amount)}</td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                </div>
              </>
            )}
            {activeTab === "Budget" && (
              <>
                <div className="admin-subsection-heading">
                  <h3>Budget by category</h3>
                  {add("categories", "Add category")}
                </div>
                <Table
                  headings={[
                    "Category",
                    "Estimated budget",
                    "Forecast",
                    "Paid",
                    "Balance",
                    "Under / (over)",
                    "Actions",
                  ]}
                  empty="No categories."
                >
                  {s.categories.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <small>
                          {c.unestimated
                            ? `${c.unestimated} uncosted item(s)`
                            : ""}
                        </small>
                      </td>
                      <td>{money(c.budget)}</td>
                      <td>{money(c.forecast)}</td>
                      <td>{money(c.paid)}</td>
                      <td>{money(c.balance)}</td>
                      <td>{money(c.variance)}</td>
                      <td>
                        {actions(
                          "categories",
                          c.id,
                          c.name,
                          !d.expenses.some((e) => e.category_id === c.id),
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
                <p className="admin-content-help">
                  Positive variance is under budget; negative is over budget.
                  Unset budgets remain “Not estimated”.
                </p>
              </>
            )}
            {activeTab === "Expenses" && (
              <>
                <div className="admin-subsection-heading">
                  <h3>Expenses and payment history</h3>
                  {add("expenses", "Add expense")}
                </div>
                <div className="planner-filters">
                  <input
                    aria-label="Search expenses"
                    placeholder="Search expense or vendor"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    aria-label="Expense category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {d.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Payment status"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending balance</option>
                    <option value="paid">Fully paid</option>
                    <option value="unknown">Not estimated</option>
                  </select>
                </div>
                <Table
                  headings={[
                    "Expense / vendor",
                    "Category",
                    "Estimate",
                    "Agreed cost",
                    "Paid",
                    "Balance",
                    "Due",
                    "Actions",
                  ]}
                  empty="No matching expenses."
                >
                  {d.expenses
                    .filter((e) => {
                      const t = s.expenses[e.id];
                      const text = `${e.name} ${d.vendors.find((v) => v.id === e.vendor_id)?.name ?? ""}`;
                      return (
                        text.toLowerCase().includes(search.toLowerCase()) &&
                        (!categoryFilter || e.category_id === categoryFilter) &&
                        (paymentFilter === "all" ||
                          (paymentFilter === "pending" &&
                            (t.balance ?? 0) > 0) ||
                          (paymentFilter === "paid" && t.balance === 0) ||
                          (paymentFilter === "unknown" && t.forecast === null))
                      );
                    })
                    .map((e) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.name}</strong>
                          <small>
                            {d.vendors.find((v) => v.id === e.vendor_id)
                              ?.name ?? "Vendor not assigned"}
                          </small>
                          <small>{e.notes}</small>
                        </td>
                        <td>
                          {
                            d.categories.find((c) => c.id === e.category_id)
                              ?.name
                          }
                        </td>
                        <td>{money(e.estimate)}</td>
                        <td>
                          {e.actual === null ? "Not agreed" : money(e.actual)}
                        </td>
                        <td>{money(s.expenses[e.id]?.paid)}</td>
                        <td>{money(s.expenses[e.id]?.balance)}</td>
                        <td>{displayDate(e.due_date)}</td>
                        <td>
                          {actions(
                            "expenses",
                            e.id,
                            e.name,
                            !d.payments.some((p) => p.expense_id === e.id) &&
                              !d.installments.some(
                                (i) => i.expense_id === e.id,
                              ),
                          )}
                          {canManage && (
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                disabled={
                                  disabled || !s.expenses[e.id]?.balance
                                }
                                onClick={() =>
                                  openEditor("payments", null, {
                                    expense_id: e.id,
                                    paid_date: manilaToday(),
                                  })
                                }
                              >
                                Record payment
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </Table>
                <div className="admin-subsection-heading">
                  <h3>Recorded payments</h3>
                  {add("payments", "Record payment")}
                </div>
                <Table
                  headings={[
                    "Expense",
                    "Date",
                    "Amount",
                    "Reference / notes",
                    "Actions",
                  ]}
                  empty="No recorded payments."
                >
                  {d.payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {expenseName(p.expense_id)}
                        <small>
                          {
                            d.installments.find(
                              (i) => i.id === p.installment_id,
                            )?.name
                          }
                        </small>
                      </td>
                      <td>{displayDate(p.paid_date)}</td>
                      <td>{money(p.amount)}</td>
                      <td>
                        {p.reference}
                        <small>{p.notes}</small>
                      </td>
                      <td>
                        {actions(
                          "payments",
                          p.id,
                          `${money(p.amount)} payment`,
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {activeTab === "Installments" && (
              <>
                <div className="admin-subsection-heading">
                  <h3>Installment schedule</h3>
                  {add("installments", "Add installment")}
                </div>
                <p className="admin-content-help">
                  Payments linked to an installment reduce both its balance and
                  the expense balance. Unlinked payments do not settle scheduled
                  installments.
                </p>
                <Table
                  headings={[
                    "Expense / installment",
                    "Due date",
                    "Scheduled",
                    "Paid",
                    "Remaining",
                    "Status",
                    "Actions",
                  ]}
                  empty="No installments."
                >
                  {[...d.installments]
                    .sort((a, b) => a.due_date.localeCompare(b.due_date))
                    .map((i) => {
                      const paid = installmentPaid(i.id);
                      const remaining = i.amount - paid;
                      return (
                        <tr key={i.id}>
                          <td>
                            {expenseName(i.expense_id)}
                            <small>{i.name}</small>
                          </td>
                          <td>{displayDate(i.due_date)}</td>
                          <td>{money(i.amount)}</td>
                          <td>{money(paid)}</td>
                          <td>{money(remaining)}</td>
                          <td>
                            {!remaining
                              ? "Paid"
                              : i.due_date < s.as_of
                                ? "Overdue"
                                : paid
                                  ? "Partially paid"
                                  : "Pending"}
                          </td>
                          <td>
                            {actions(
                              "installments",
                              i.id,
                              i.name,
                              !d.payments.some(
                                (p) => p.installment_id === i.id,
                              ),
                            )}
                            {canManage && remaining > 0 && (
                              <div className="admin-row-actions">
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    openEditor("payments", null, {
                                      expense_id: i.expense_id,
                                      installment_id: i.id,
                                      amount: moneyInput(remaining),
                                      paid_date: manilaToday(),
                                    })
                                  }
                                >
                                  Record payment
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </Table>
              </>
            )}
            {activeTab === "Vendors" && (
              <>
                <div className="admin-subsection-heading">
                  <h3>Wedding vendors</h3>
                  {add("vendors", "Add vendor")}
                </div>
                <Table
                  headings={[
                    "Vendor",
                    "Service / contact",
                    "Forecast",
                    "Paid",
                    "Outstanding",
                    "Actions",
                  ]}
                  empty="No vendors. Add suppliers and link them to expenses."
                >
                  {d.vendors.map((v) => {
                    const linked = d.expenses.filter(
                      (e) => e.vendor_id === v.id,
                    );
                    return (
                      <tr key={v.id}>
                        <td>
                          {v.name}
                          <small>{v.notes}</small>
                        </td>
                        <td>
                          {v.service}
                          <small>{v.contact}</small>
                        </td>
                        <td>
                          {money(
                            linked.reduce(
                              (sum, e) =>
                                sum + (s.expenses[e.id]?.forecast ?? 0),
                              0,
                            ),
                          )}
                        </td>
                        <td>
                          {money(
                            linked.reduce(
                              (sum, e) => sum + (s.expenses[e.id]?.paid ?? 0),
                              0,
                            ),
                          )}
                        </td>
                        <td>
                          {money(
                            linked.reduce(
                              (sum, e) =>
                                sum + (s.expenses[e.id]?.balance ?? 0),
                              0,
                            ),
                          )}
                        </td>
                        <td>
                          {actions("vendors", v.id, v.name, !linked.length)}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </>
            )}
            {activeTab === "Checklist" && (
              <>
                <div className="admin-subsection-heading">
                  <h3>Wedding checklist</h3>
                  {add("checklist", "Add task")}
                </div>
                <Table
                  headings={["Task", "Due", "Status", "Actions"]}
                  empty="No tasks."
                >
                  {d.checklist.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.name}
                        <small>{t.notes}</small>
                      </td>
                      <td>{displayDate(t.due_date)}</td>
                      <td>
                        {t.completed
                          ? "Completed"
                          : t.due_date && t.due_date < s.as_of
                            ? "Overdue"
                            : "Pending"}
                      </td>
                      <td>
                        {actions("checklist", t.id, t.name)}
                        {canManage && (
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                const doc = structuredClone(d);
                                doc.checklist = doc.checklist.map((item) =>
                                  item.id === t.id
                                    ? { ...item, completed: !item.completed }
                                    : item,
                                );
                                void persist(doc, "Task updated.");
                              }}
                            >
                              {t.completed ? "Reopen" : "Complete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </div>
        </>
      )}
      {editor && d && (
        <PlannerDialog
          title={`${editor.id ? "Edit" : "Add"} ${labels[editor.collection]}`}
          onClose={() => setEditor(null)}
          busy={saving}
        >
          <form onSubmit={(event) => void submitEditor(event)}>
            <div className="admin-form-grid">
              {editor.collection !== "payments" && (
                <Field
                  label="Name"
                  field="name"
                  editor={editor}
                  setEditor={setEditor}
                  required
                  maxLength={editor.collection === "checklist" ? 500 : 200}
                />
              )}
              {editor.collection === "categories" && (
                <Field
                  label="Estimated budget (PHP)"
                  field="budget"
                  editor={editor}
                  setEditor={setEditor}
                  amount
                />
              )}
              {editor.collection === "expenses" && (
                <>
                  <SelectField
                    label="Category"
                    field="category_id"
                    editor={editor}
                    setEditor={setEditor}
                    required
                    options={d.categories.map((c) => [c.id, c.name])}
                  />
                  <SelectField
                    label="Vendor"
                    field="vendor_id"
                    editor={editor}
                    setEditor={setEditor}
                    options={d.vendors.map((v) => [v.id, v.name])}
                  />
                  <Field
                    label="Estimated cost (PHP)"
                    field="estimate"
                    editor={editor}
                    setEditor={setEditor}
                    amount
                  />
                  <Field
                    label="Agreed cost (PHP)"
                    field="actual"
                    editor={editor}
                    setEditor={setEditor}
                    amount
                  />
                  <Field
                    label="Balance due date"
                    field="due_date"
                    editor={editor}
                    setEditor={setEditor}
                    type="date"
                  />
                </>
              )}
              {(editor.collection === "payments" ||
                editor.collection === "installments") && (
                <>
                  <SelectField
                    label="Expense"
                    field="expense_id"
                    editor={editor}
                    setEditor={setEditor}
                    required
                    options={d.expenses.map((e) => [e.id, e.name])}
                  />
                  <Field
                    label="Amount (PHP)"
                    field="amount"
                    editor={editor}
                    setEditor={setEditor}
                    amount
                    required
                  />
                </>
              )}
              {editor.collection === "payments" && (
                <>
                  <SelectField
                    label="Apply to installment"
                    field="installment_id"
                    editor={editor}
                    setEditor={setEditor}
                    options={d.installments
                      .filter((i) => i.expense_id === editor.values.expense_id)
                      .map((i) => [
                        i.id,
                        `${i.name} — ${displayDate(i.due_date)}`,
                      ])}
                  />
                  <Field
                    label="Payment date (blank if unknown)"
                    field="paid_date"
                    editor={editor}
                    setEditor={setEditor}
                    type="date"
                    max={manilaToday()}
                  />
                  <Field
                    label="Reference / payment method"
                    field="reference"
                    editor={editor}
                    setEditor={setEditor}
                    maxLength={200}
                  />
                </>
              )}
              {(editor.collection === "installments" ||
                editor.collection === "checklist") && (
                <Field
                  label="Due date"
                  field="due_date"
                  editor={editor}
                  setEditor={setEditor}
                  type="date"
                  required={editor.collection === "installments"}
                />
              )}
              {editor.collection === "vendors" && (
                <>
                  <Field
                    label="Service"
                    field="service"
                    editor={editor}
                    setEditor={setEditor}
                    maxLength={200}
                  />
                  <Field
                    label="Contact details"
                    field="contact"
                    editor={editor}
                    setEditor={setEditor}
                    maxLength={500}
                  />
                </>
              )}
              {editor.collection === "checklist" && (
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={editor.values.completed === "true"}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        values: {
                          ...editor.values,
                          completed: String(e.target.checked),
                        },
                      })
                    }
                  />
                  Completed
                </label>
              )}
            </div>
            {!["categories", "installments"].includes(editor.collection) && (
              <label>
                Notes
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={editor.values.notes ?? ""}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      values: { ...editor.values, notes: e.target.value },
                    })
                  }
                />
              </label>
            )}
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-editor-actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button type="submit" disabled={disabled}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </PlannerDialog>
      )}
      {removal && (
        <PlannerDialog
          title="Confirm removal"
          onClose={() => setRemoval(null)}
          busy={saving}
        >
          <p>
            Remove {removal.name}? This changes planner totals. Linked records
            must be removed or reassigned first.
          </p>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-editor-actions">
            <button
              type="button"
              disabled={saving}
              onClick={() => setRemoval(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void removeRecord()}
            >
              Remove
            </button>
          </div>
        </PlannerDialog>
      )}
      {review && (
        <PlannerDialog
          title="Review workbook import"
          onClose={() => setReview(null)}
          busy={saving}
        >
          <p>
            {review.filename}: {review.document.expenses.length} expenses; cost{" "}
            {money(review.cost)}, paid {money(review.paid)}, outstanding{" "}
            {money(review.cost - review.paid)}.
          </p>
          {review.warnings.map((w) => (
            <p key={w} className="admin-rsvp-setting-note">
              {w}
            </p>
          ))}
          <Table
            headings={["Category", "Expense", "Cost", "Opening paid"]}
            empty="No expenses."
          >
            {review.document.expenses.map((e) => (
              <tr key={e.id}>
                <td>
                  {
                    review.document.categories.find(
                      (c) => c.id === e.category_id,
                    )?.name
                  }
                </td>
                <td>{e.name}</td>
                <td>{money(e.actual)}</td>
                <td>
                  {money(
                    review.document.payments
                      .filter((p) => p.expense_id === e.id)
                      .reduce((sum, p) => sum + p.amount, 0),
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {!!review.schedules.length && (
            <>
              <h3>Confirm unpaid installments to include</h3>
              <p className="admin-content-help">
                Select only unpaid rows. Correct dates and suggested amounts
                before importing.
              </p>
              <div className="planner-schedule-review">
                {review.schedules.map((item, index) => (
                  <div key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.include}
                        onChange={(e) =>
                          setReview({
                            ...review,
                            schedules: review.schedules.map((row, i) =>
                              i === index
                                ? { ...row, include: e.target.checked }
                                : row,
                            ),
                          })
                        }
                      />
                      {item.name} — workbook: {item.workbookStatus}
                    </label>
                    <input
                      type="date"
                      aria-label={`Installment ${index + 1} due date`}
                      value={item.due_date}
                      onChange={(e) =>
                        setReview({
                          ...review,
                          schedules: review.schedules.map((row, i) =>
                            i === index
                              ? { ...row, due_date: e.target.value }
                              : row,
                          ),
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-label={`Installment ${index + 1} amount`}
                      value={moneyInput(item.amount)}
                      onChange={(e) =>
                        setReview({
                          ...review,
                          schedules: review.schedules.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  amount: Math.round(
                                    Number(e.target.value) * 100,
                                  ),
                                }
                              : row,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={importConfirmed}
              onChange={(e) => setImportConfirmed(e.target.checked)}
            />
            I reviewed the detailed budget, opening paid balances,
            discrepancies, and selected unpaid schedules.
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-editor-actions">
            <button
              type="button"
              disabled={saving}
              onClick={() => setReview(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled || !importConfirmed}
              onClick={() => void confirmImport()}
            >
              {saving ? "Importing…" : "Import reviewed workbook"}
            </button>
          </div>
        </PlannerDialog>
      )}
    </section>
  );
}

function Table({
  headings,
  children,
  empty,
}: {
  headings: string[];
  children: ReactNode[];
  empty: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-guest-table planner-table">
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children.length ? (
            children
          ) : (
            <tr>
              <td colSpan={headings.length} className="admin-table-message">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function PlannerDialog({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <div className="admin-editor-backdrop">
      <div
        className="admin-guest-editor planner-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-dialog-title"
        tabIndex={-1}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") {
            const nodes = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
            );
            if (!nodes?.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="admin-editor-header">
          <h2 id="planner-dialog-title">{title}</h2>
          <button type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
type FieldProps = {
  label: string;
  field: string;
  editor: Editor;
  setEditor: (editor: Editor) => void;
  required?: boolean;
};
function Field({
  label,
  field,
  editor,
  setEditor,
  amount,
  type = "text",
  required = false,
  maxLength,
  max,
}: FieldProps & {
  amount?: boolean;
  type?: string;
  maxLength?: number;
  max?: string;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={amount ? "number" : type}
        min={amount ? "0" : undefined}
        step={amount ? "0.01" : undefined}
        max={amount ? "1000000000" : max}
        maxLength={maxLength}
        required={required}
        value={editor.values[field] ?? ""}
        onChange={(e) =>
          setEditor({
            ...editor,
            values: { ...editor.values, [field]: e.target.value },
          })
        }
      />
    </label>
  );
}
function SelectField({
  label,
  field,
  editor,
  setEditor,
  options,
  required = false,
}: FieldProps & { options: string[][] }) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        required={required}
        value={editor.values[field] ?? ""}
        onChange={(e) =>
          setEditor({
            ...editor,
            values: {
              ...editor.values,
              [field]: e.target.value,
              ...(field === "expense_id" ? { installment_id: "" } : {}),
            },
          })
        }
      >
        <option value="">{required ? "Select…" : "None"}</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
