import type {
  PlannerDocument,
  PlannerExpense,
  PlannerInstallment,
} from "./plannerTypes";

export type ScheduleReview = PlannerInstallment & {
  include: boolean;
  workbookStatus: string;
};
export type PlannerImportReview = {
  document: PlannerDocument;
  schedules: ScheduleReview[];
  warnings: string[];
  cost: number;
  paid: number;
  filename: string;
};

// Parse workbook data only. No cell text is executed or interpreted as instructions.
export async function reviewPlannerWorkbook(
  file: File,
  current: PlannerDocument,
): Promise<PlannerImportReview> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a workbook smaller than 5 MB.");
  if (
    current.expenses.length ||
    current.payments.length ||
    current.installments.length
  )
    throw new Error(
      "Workbook import is available only before expenses are added, to avoid duplicate financial records.",
    );
  const bytes = await file.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (current.imports.some((source) => source.fingerprint === hash))
    throw new Error("This workbook has already been imported.");
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default ?? xlsxModule;
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const sheet = workbook.Sheets["Wedding Budget"];
  if (!sheet)
    throw new Error('This workbook must contain a "Wedding Budget" sheet.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  const document: PlannerDocument = structuredClone(current);
  const amount = (value: unknown) => {
    if (value == null || value === "") return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error(
        "The workbook contains an invalid expense amount. Correct it before importing.",
      );
    return Math.round(value * 100);
  };
  for (const offset of [0, 5]) {
    const knownCategories = new Set(
      offset === 0
        ? ["Apparel", "Flowers", "Photography / Video", "Rings", "Misc"]
        : [
            "Ceremony",
            "Reception",
            "Gifts & Favors",
            "Stationary",
            "Honeymoon",
          ],
    );
    let category = "";
    let inChecklist = false;
    for (const row of rows) {
      const label = String(row[offset] ?? "").trim();
      if (!label) continue;
      if (label === "Other matters to consider/secure:") {
        inChecklist = true;
        continue;
      }
      if (inChecklist) {
        if (label.startsWith("-"))
          document.checklist.push({
            id: crypto.randomUUID(),
            name: label.replace(/^-\s*/, ""),
            due_date: null,
            completed: false,
            notes: "Imported from workbook.",
          });
        continue;
      }
      if (knownCategories.has(label)) {
        category = label;
        if (!document.categories.some((c) => c.name === category))
          document.categories.push({
            id: crypto.randomUUID(),
            name: category,
            budget: null,
          });
        continue;
      }
      if (!category || label.startsWith("Total ")) continue;
      const actual = amount(row[offset + 1]);
      const paid = amount(row[offset + 2]);
      const expense: PlannerExpense = {
        id: crypto.randomUUID(),
        name: label,
        category_id: document.categories.find((c) => c.name === category)!.id,
        vendor_id: null,
        estimate: null,
        actual,
        due_date: null,
        notes:
          "Imported from Wedding Budget. Vendor and payment dates need review.",
      };
      if (paid && (actual == null || paid > actual))
        throw new Error(
          `Paid amount exceeds the cost for ${label}. Correct the workbook first.`,
        );
      document.expenses.push(expense);
      if (paid)
        document.payments.push({
          id: crypto.randomUUID(),
          expense_id: expense.id,
          installment_id: null,
          amount: paid,
          paid_date: null,
          reference: "Workbook opening paid balance",
          notes:
            "Aggregate payment from Wedding Budget; individual payment dates were not provided.",
        });
    }
  }
  if (!document.expenses.length)
    throw new Error("No expenses were found in Wedding Budget.");
  const cost = document.expenses.reduce((sum, e) => sum + (e.actual ?? 0), 0);
  const paid = document.payments.reduce((sum, p) => sum + p.amount, 0);
  const warnings = [
    "Import uses actual item costs and paid amounts from Wedding Budget. Blank actual prices remain Price not set. No vendors are inferred.",
    "Opening paid balances are aggregates with unknown payment dates. They must not be entered again as new payments.",
  ];
  const summary = workbook.Sheets["Summary"];
  if (summary) {
    const values = XLSX.utils.sheet_to_json<unknown[]>(summary, {
      header: 1,
      defval: null,
    });
    const summaryTotal = values.find((r) =>
      String(r[0] ?? "").includes("Total Actual Spend"),
    );
    if (summaryTotal && amount(summaryTotal[1]) !== cost)
      warnings.push(
        "The Summary sheet total differs from the detailed Wedding Budget total. This import uses Wedding Budget.",
      );
  }
  const schedules: ScheduleReview[] = [];
  const scheduleSheet = workbook.Sheets["MONTHLY INSTALLMENTS"];
  if (scheduleSheet) {
    const values = XLSX.utils.sheet_to_json<unknown[]>(scheduleSheet, {
      header: 1,
      defval: null,
      range: 0,
    });
    const contract = values.find(
      (r) =>
        typeof r[1] === "string" &&
        document.expenses.some((e) => e.name === String(r[1]).trim()),
    );
    const expense = contract
      ? document.expenses.find((e) => e.name === String(contract[1]).trim())
      : undefined;
    const suggested = contract ? amount(contract[6]) : null;
    if (expense)
      for (const row of values) {
        if (typeof row[1] !== "number" || row[1] < 40000 || row[1] > 60000)
          continue;
        const parsed = XLSX.SSF.parse_date_code(row[1]);
        if (!parsed) continue;
        const due = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        const status = String(row[2] ?? "").trim();
        schedules.push({
          id: crypto.randomUUID(),
          expense_id: expense.id,
          name: `${expense.name} installment`,
          amount: amount(row[3]) ?? suggested ?? 0,
          due_date: due,
          include: false,
          workbookStatus: status || "Unspecified",
        });
      }
    warnings.push(
      "Installment statuses and paid totals need reconciliation. All schedule rows start excluded. Select only confirmed unpaid installments; completed rows are already covered by the opening paid balance. Suggested amounts for blank rows require confirmation.",
    );
  }
  document.imports.push({ fingerprint: hash, name: file.name });
  return { document, schedules, warnings, cost, paid, filename: file.name };
}
