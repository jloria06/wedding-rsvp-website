import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMonthlyPlan,
  monthlyDate,
  paymentPlanTotals,
  previewMonthlyPlan,
  switchToFlexiblePayments,
} from "../src/admin/paymentPlans.ts";
import { validatePlannerDraft } from "../src/admin/plannerTypes.ts";

const document = () => ({
  categories: [{ id: "c", name: "Carts", budget: null }],
  vendors: [],
  checklist: [],
  imports: [],
  expenses: [
    {
      id: "e",
      name: "Carts",
      category_id: "c",
      vendor_id: null,
      estimate: null,
      actual: 8900000,
      due_date: "2027-03-13",
      notes: "",
    },
  ],
  payments: [
    {
      id: "deposit",
      expense_id: "e",
      installment_id: null,
      amount: 1000000,
      paid_date: null,
      reference: "",
      notes: "",
    },
    {
      id: "paid",
      expense_id: "e",
      installment_id: "old",
      amount: 383333,
      paid_date: null,
      reference: "",
      notes: "",
    },
  ],
  installments: [
    {
      id: "old",
      expense_id: "e",
      name: "Previous monthly payment",
      amount: 383333,
      due_date: "2026-04-18",
    },
  ],
});
const input = {
  monthlyAmount: 383333,
  count: 3,
  firstDate: "2026-12-18",
  finalDate: "2027-03-13",
};

test("plan uses the 89k contract minus existing payments, exactly once", () => {
  const d = document();
  const plan = applyMonthlyPlan(d, "e", input);
  assert.equal(paymentPlanTotals(d, "e").unscheduled, 7516667);
  assert.equal(plan.expenses[0].payment_arrangement, "installment");
  assert.equal(plan.installments.length, 5);
  assert.equal(plan.installments.at(-1).amount, 6366668);
  assert.equal(paymentPlanTotals(plan, "e").unscheduled, 0);
  assert.deepEqual(plan.payments, d.payments);
  assert.deepEqual(plan.installments[0], d.installments[0]);
  validatePlannerDraft(plan);
  assert.throws(
    () => applyMonthlyPlan(plan, "e", input),
    /already paid or scheduled/,
  );
});

test("existing unpaid schedules are deducted before generating more", () => {
  const d = document();
  d.installments.push({
    id: "pending",
    expense_id: "e",
    name: "Pending",
    amount: 100000,
    due_date: "2026-12-01",
  });
  const plan = applyMonthlyPlan(d, "e", input);
  assert.equal(plan.installments.at(-1).amount, 6266668);
  validatePlannerDraft(plan);
});

test("monthly dates preserve the original day across month ends and leap years", () => {
  assert.equal(monthlyDate("2027-01-31", 1), "2027-02-28");
  assert.equal(monthlyDate("2027-01-31", 2), "2027-03-31");
  assert.equal(monthlyDate("2028-01-31", 1), "2028-02-29");
  assert.equal(monthlyDate("2026-12-18", 2), "2027-02-18");
});

test("last monthly payment is capped to the exact centavo balance", () => {
  const d = document();
  d.expenses[0].actual = 1001;
  d.payments = [];
  d.installments = [];
  const rows = previewMonthlyPlan(d, "e", {
    monthlyAmount: 333,
    count: 12,
    firstDate: "2027-01-31",
    finalDate: "",
  });
  assert.deepEqual(
    rows.map((i) => i.amount),
    [333, 333, 333, 2],
  );
});

test("switching to flexible cancels only unpaid schedules and keeps paid history", () => {
  const plan = applyMonthlyPlan(document(), "e", input);
  const flexible = switchToFlexiblePayments(plan, "e");
  assert.deepEqual(flexible.payments, plan.payments);
  assert.equal(flexible.installments[0].cancelled, undefined);
  assert(flexible.installments.slice(1).every((i) => i.cancelled));
  assert.equal(paymentPlanTotals(flexible, "e").unscheduled, 7516667);
  validatePlannerDraft(flexible);
});

test("partial payment and cancelled history never produce duplicate pending balances", () => {
  const d = document();
  d.installments[0].amount = 500000;
  const flexible = switchToFlexiblePayments(d, "e");
  assert.equal(flexible.installments[0].cancelled, true);
  assert.equal(paymentPlanTotals(flexible, "e").pending.length, 0);
  assert.equal(paymentPlanTotals(flexible, "e").paid, 1383333);
  validatePlannerDraft(flexible);
});

test("invalid monthly agreements are rejected before saving", () => {
  for (const patch of [
    { monthlyAmount: 0 },
    { count: 0 },
    { count: 121 },
    { count: 1.5 },
    { firstDate: "2027-02-30" },
    { finalDate: "2026-01-01" },
  ])
    assert.throws(() =>
      previewMonthlyPlan(document(), "e", { ...input, ...patch }),
    );
  const unknown = document();
  unknown.expenses[0].actual = null;
  assert.throws(
    () => previewMonthlyPlan(unknown, "e", input),
    /actual price first/,
  );
});

test("legacy estimates never become actual prices or enable a new payment plan", () => {
  const d = document();
  d.expenses[0].estimate = 9000000;
  d.expenses[0].actual = null;
  const previous = structuredClone(d);
  assert.equal(paymentPlanTotals(d, "e").cost, null);
  assert.equal(paymentPlanTotals(d, "e").balance, null);
  assert.throws(() => previewMonthlyPlan(d, "e", input), /actual price first/);
  validatePlannerDraft(d, previous);
  d.payments[0].amount += 1;
  assert.throws(() => validatePlannerDraft(d, previous), /actual price/);
});
