import { useState, type FormEvent } from "react";
import {
  applyMonthlyPlan,
  paymentPlanTotals,
  previewMonthlyPlan,
} from "./paymentPlans";
import {
  displayDate,
  money,
  parseMoney,
  type PlannerDocument,
} from "./plannerTypes";

export function MonthlyPlanForm({
  document,
  initialExpenseId,
  busy,
  error,
  onSave,
}: {
  document: PlannerDocument;
  initialExpenseId: string;
  busy: boolean;
  error: string;
  onSave: (document: PlannerDocument) => Promise<void>;
}) {
  const [expenseId, setExpenseId] = useState(initialExpenseId);
  const [monthly, setMonthly] = useState("");
  const [count, setCount] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [finalDate, setFinalDate] = useState(
    document.expenses.find((e) => e.id === initialExpenseId)?.due_date ?? "",
  );
  const [preview, setPreview] = useState(false);
  const [localError, setLocalError] = useState("");
  const totals = paymentPlanTotals(document, expenseId);
  const input = {
    monthlyAmount: parseMoneySafe(monthly),
    count: Number(count),
    firstDate,
    finalDate,
  };
  let rows: ReturnType<typeof previewMonthlyPlan> = [];
  if (preview) {
    try {
      rows = previewMonthlyPlan(document, expenseId, input);
    } catch {
      /* Displayed on submit. */
    }
  }
  const edit = (fn: () => void) => {
    fn();
    setPreview(false);
    setLocalError("");
  };
  const finalBalance = Math.max(
    0,
    (totals.unscheduled ?? 0) -
      input.monthlyAmount * (Number.isFinite(input.count) ? input.count : 0),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      previewMonthlyPlan(document, expenseId, {
        ...input,
        monthlyAmount: parseMoney(monthly) ?? 0,
      });
      if (!preview) {
        setPreview(true);
        setLocalError("");
        return;
      }
      await onSave(applyMonthlyPlan(document, expenseId, input));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Check the payment plan.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <p className="admin-content-help">
        Set this up once. Monthly payments are created automatically; record
        each actual payment from its scheduled row.
      </p>
      <label>
        Expense
        <select
          aria-label="Plan expense"
          required
          value={expenseId}
          onChange={(e) =>
            edit(() => {
              setExpenseId(e.target.value);
              setFinalDate(
                document.expenses.find((item) => item.id === e.target.value)
                  ?.due_date ?? "",
              );
            })
          }
        >
          <option value="">Select an expense</option>
          {document.expenses.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      {expenseId && (
        <>
          <div className="planner-plan-totals">
            <div>
              Total cost<strong>{money(totals.cost)}</strong>
            </div>
            <div>
              Already paid<strong>{money(totals.paid)}</strong>
            </div>
            <div>
              Remaining balance<strong>{money(totals.balance)}</strong>
            </div>
            <div>
              Available to schedule<strong>{money(totals.unscheduled)}</strong>
            </div>
          </div>
          <p className="admin-content-help">
            Existing payments and scheduled amounts are already deducted. This
            setup adds only the remaining unscheduled balance.
          </p>
          <div className="admin-form-grid">
            <label>
              Monthly payment (PHP)
              <input
                aria-label="Monthly payment (PHP)"
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                required
                value={monthly}
                onChange={(e) => edit(() => setMonthly(e.target.value))}
              />
            </label>
            <label>
              Number of monthly payments
              <input
                aria-label="Number of monthly payments"
                type="number"
                min="1"
                max="120"
                step="1"
                required
                value={count}
                onChange={(e) => edit(() => setCount(e.target.value))}
              />
            </label>
            <label>
              First payment due
              <input
                aria-label="First payment due"
                type="date"
                required
                value={firstDate}
                onChange={(e) => edit(() => setFirstDate(e.target.value))}
              />
            </label>
            {finalBalance > 0 && (
              <label>
                Final balance due
                <input
                  aria-label="Final balance due"
                  type="date"
                  required
                  value={finalDate}
                  onChange={(e) => edit(() => setFinalDate(e.target.value))}
                />
              </label>
            )}
          </div>
          {finalBalance > 0 && (
            <p className="admin-rsvp-setting-note">
              After these monthly payments, a final payment of{" "}
              {money(finalBalance)} will be scheduled on the final balance date.
            </p>
          )}
          {preview && (
            <>
              <h3>Review your schedule</h3>
              <p className="admin-content-help">
                No payments are recorded by saving this plan. The last monthly
                amount is reduced if needed to avoid charging more than the
                remaining balance.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-guest-table planner-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Due date</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td>{row.name}</td>
                        <td>{displayDate(row.due_date)}</td>
                        <td>{money(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      {(localError || error) && (
        <p className="admin-error" role="alert">
          {localError || error}
        </p>
      )}
      <div className="admin-editor-actions">
        <button type="submit" disabled={busy || !expenseId}>
          {busy
            ? "Saving…"
            : preview
              ? "Save payment plan"
              : "Preview schedule"}
        </button>
      </div>
    </form>
  );
}

function parseMoneySafe(value: string) {
  try {
    return parseMoney(value) ?? 0;
  } catch {
    return 0;
  }
}
