export type PlannerCategory = {
  id: string;
  name: string;
  budget: number | null;
};
export type PlannerVendor = {
  id: string;
  name: string;
  service: string;
  contact: string;
  notes: string;
};
export type PlannerExpense = {
  payment_arrangement?: "flexible" | "installment";
  id: string;
  name: string;
  category_id: string;
  vendor_id: string | null;
  estimate: number | null;
  actual: number | null;
  due_date: string | null;
  notes: string;
};
export type PlannerInstallment = {
  cancelled?: boolean;
  id: string;
  name: string;
  expense_id: string;
  amount: number;
  due_date: string;
};
export type PlannerPayment = {
  id: string;
  expense_id: string;
  installment_id: string | null;
  amount: number;
  paid_date: string | null;
  reference: string;
  notes: string;
};
export type PlannerTask = {
  id: string;
  name: string;
  due_date: string | null;
  completed: boolean;
  notes: string;
};
export type PlannerDocument = {
  categories: PlannerCategory[];
  vendors: PlannerVendor[];
  expenses: PlannerExpense[];
  installments: PlannerInstallment[];
  payments: PlannerPayment[];
  checklist: PlannerTask[];
  imports: { fingerprint: string; name: string }[];
};
export type ExpenseTotals = {
  forecast: number | null;
  paid: number;
  balance: number | null;
};
export type PlannerSummary = {
  budget: number | null;
  forecast: number;
  paid: number;
  balance: number;
  overdue: number;
  unestimated: number;
  unbudgeted: number;
  as_of: string;
  expenses: Record<string, ExpenseTotals>;
  categories: (PlannerCategory &
    ExpenseTotals & { variance: number | null; unestimated: number })[];
  monthly: { month: string; amount: number }[];
  due: {
    expense_id: string;
    name: string;
    label: string;
    amount: number;
    due_date: string | null;
  }[];
};
export type PlannerResponse = {
  revision: number;
  document: PlannerDocument;
  summary: PlannerSummary;
};

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});
export const money = (cents: number | null | undefined) =>
  cents == null ? "Not estimated" : peso.format(cents / 100);
export const moneyInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);
export const manilaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const displayDate = (date: string | null) =>
  date
    ? new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "Undated";
export function parseMoney(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000)
    throw new Error("Amount is too large.");
  return cents;
}

export function validatePlannerDraft(document: PlannerDocument) {
  const expenseIds = new Set(document.expenses.map((e) => e.id));
  const categoryIds = new Set(document.categories.map((c) => c.id));
  const vendorIds = new Set(document.vendors.map((v) => v.id));
  const schedules = new Map(document.installments.map((i) => [i.id, i]));
  for (const item of [
    ...document.categories,
    ...document.expenses,
    ...document.installments,
    ...document.vendors,
    ...document.checklist,
  ])
    if (!item.name.trim()) throw new Error("Name cannot be blank.");
  for (const p of document.payments) {
    if (!expenseIds.has(p.expense_id))
      throw new Error("Select an expense for every payment.");
    if (!Number.isSafeInteger(p.amount) || p.amount <= 0)
      throw new Error("Payment amounts must be greater than zero.");
    if (p.paid_date && p.paid_date > manilaToday())
      throw new Error("Future payments belong in the installment schedule.");
    if (
      p.installment_id &&
      schedules.get(p.installment_id)?.expense_id !== p.expense_id
    )
      throw new Error(
        "The selected installment does not belong to this expense.",
      );
  }
  for (const i of document.installments) {
    if (!expenseIds.has(i.expense_id))
      throw new Error("Select an expense for every installment.");
    if (!i.due_date || !Number.isSafeInteger(i.amount) || i.amount <= 0)
      throw new Error(
        "Every installment needs a due date and a positive amount.",
      );
    if (
      document.payments
        .filter((p) => p.installment_id === i.id)
        .reduce((sum, p) => sum + p.amount, 0) > i.amount
    )
      throw new Error(`Payments exceed the installment amount for ${i.name}.`);
  }
  for (const e of document.expenses) {
    if (!categoryIds.has(e.category_id))
      throw new Error("Select an existing category for every expense.");
    if (e.vendor_id && !vendorIds.has(e.vendor_id))
      throw new Error("Reassign linked expenses before removing this vendor.");
    const cost = e.actual ?? e.estimate;
    const paid = document.payments
      .filter((p) => p.expense_id === e.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const scheduled = document.installments
      .filter((i) => i.expense_id === e.id && !i.cancelled)
      .reduce(
        (sum, i) =>
          sum +
          i.amount -
          document.payments
            .filter((p) => p.installment_id === i.id)
            .reduce((total, p) => total + p.amount, 0),
        0,
      );
    if ((paid || scheduled) && cost === null)
      throw new Error(
        `Set the estimated or agreed cost for ${e.name} before adding payments or installments.`,
      );
    if (paid + scheduled > (cost ?? 0))
      throw new Error(
        `Payments and unpaid installments exceed the cost for ${e.name}. Link the payment to its installment or adjust the schedule first.`,
      );
  }
}
