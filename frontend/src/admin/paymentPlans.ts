import type { PlannerDocument, PlannerInstallment } from "./plannerTypes";

export function paymentPlanTotals(
  document: PlannerDocument,
  expenseId: string,
) {
  const expense = document.expenses.find((e) => e.id === expenseId);
  const cost = expense?.actual ?? null;
  const paid = document.payments
    .filter((p) => p.expense_id === expenseId)
    .reduce((sum, p) => sum + p.amount, 0);
  const scheduled = document.installments
    .filter((i) => i.expense_id === expenseId && !i.cancelled)
    .map((i) => ({
      ...i,
      remaining:
        i.amount -
        document.payments
          .filter((p) => p.installment_id === i.id)
          .reduce((sum, p) => sum + p.amount, 0),
    }));
  const pending = scheduled
    .filter((i) => i.remaining > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const balance = cost === null ? null : cost - paid;
  return {
    cost,
    paid,
    balance,
    pending,
    next: pending[0],
    unscheduled:
      balance === null
        ? null
        : balance - pending.reduce((sum, i) => sum + i.remaining, 0),
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function monthlyDate(first: string, offset: number) {
  const [year, month, day] = first.split("-").map(Number);
  const end = new Date(Date.UTC(year, month + offset, 0));
  const result = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      Math.min(day, end.getUTCDate()),
    ),
  );
  return result.toISOString().slice(0, 10);
}

export type MonthlyPlanInput = {
  monthlyAmount: number;
  count: number;
  firstDate: string;
  finalDate: string;
};
export function previewMonthlyPlan(
  document: PlannerDocument,
  expenseId: string,
  input: MonthlyPlanInput,
): Omit<PlannerInstallment, "id">[] {
  const totals = paymentPlanTotals(document, expenseId);
  if (totals.unscheduled === null)
    throw new Error("Enter the expense's actual price first.");
  if (totals.unscheduled <= 0)
    throw new Error(
      "This balance is already paid or scheduled. Your existing schedule is shown below.",
    );
  if (!Number.isSafeInteger(input.monthlyAmount) || input.monthlyAmount <= 0)
    throw new Error("Enter a monthly payment greater than zero.");
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 120)
    throw new Error("Enter between 1 and 120 monthly payments.");
  if (!validDate(input.firstDate))
    throw new Error("Choose a valid first payment date.");
  let remaining = totals.unscheduled;
  const rows: Omit<PlannerInstallment, "id">[] = [];
  for (let index = 0; index < input.count && remaining > 0; index++) {
    const amount = Math.min(input.monthlyAmount, remaining);
    rows.push({
      expense_id: expenseId,
      name: `Monthly payment ${index + 1}`,
      amount,
      due_date: monthlyDate(input.firstDate, index),
      cancelled: false,
    });
    remaining -= amount;
  }
  if (remaining) {
    if (!validDate(input.finalDate))
      throw new Error(
        "Choose a date for the final balance after the monthly payments.",
      );
    if (input.finalDate < rows[rows.length - 1].due_date)
      throw new Error(
        "The final balance date must be on or after the last monthly payment.",
      );
    rows.push({
      expense_id: expenseId,
      name: "Final balance",
      amount: remaining,
      due_date: input.finalDate,
      cancelled: false,
    });
  }
  return rows;
}

export function switchToFlexiblePayments(
  document: PlannerDocument,
  expenseId: string,
): PlannerDocument {
  return {
    ...document,
    expenses: document.expenses.map((e) =>
      e.id === expenseId ? { ...e, payment_arrangement: "flexible" } : e,
    ),
    installments: document.installments.map((i) =>
      i.expense_id === expenseId &&
      !i.cancelled &&
      document.payments
        .filter((p) => p.installment_id === i.id)
        .reduce((sum, p) => sum + p.amount, 0) < i.amount
        ? { ...i, cancelled: true }
        : i,
    ),
  };
}

export function applyMonthlyPlan(
  document: PlannerDocument,
  expenseId: string,
  input: MonthlyPlanInput,
): PlannerDocument {
  const rows = previewMonthlyPlan(document, expenseId, input);
  return {
    ...document,
    expenses: document.expenses.map((e) =>
      e.id === expenseId ? { ...e, payment_arrangement: "installment" } : e,
    ),
    installments: [
      ...document.installments,
      ...rows.map((row) => ({ ...row, id: crypto.randomUUID() })),
    ],
  };
}
