# Wedding Planner

The planner lives inside the existing authenticated `/admin/planner` page.
Its data is private and is never returned by public wedding-content APIs.
Administrators can edit; viewers can read. Updates are recorded in the audit log.

## Storage and calculations

The `wedding_planner` table holds one validated JSON document, a revision,
timestamps, and the last editor. This follows the wedding-content storage pattern.
`GET /api/admin/planner` loads it; `PUT /api/admin/planner` saves atomically.
A stale revision receives HTTP 409; reload before retrying. An empty planner is
returned without inserting a row until the first save. There is no automatic seed
of private workbook data in migrations or source code.

Amounts are integer PHP centavos. Blank budgets and estimates remain unknown.
Expense forecast = agreed cost when present, otherwise estimate. Outstanding =
forecast minus recorded payments. Budget variance = category budget minus forecast.
Unknown expense costs are counted and displayed as incomplete forecasts.

Installments are planned payments, not additional costs. A payment linked to an
installment reduces both balances. Pending monthly cash requirements include
unpaid installments plus unscheduled expense balances, using the expense deadline
where present and an explicit Undated bucket otherwise. Overdue means before the
current Manila date; a payment due today is not overdue. Payments plus unpaid
installments cannot exceed an expense's forecast. Refunds/overpayments are not
supported by this first ledger. Correct costs or schedules before recording them.

## Workbook review

Use **Review workbook** before adding expenses. The browser reads the selected
`.xlsx` locally, previews the records, and requires confirmation before saving.
The detailed **Wedding Budget** sheet supplies categories, expense costs, opening
paid balances, and the three checklist reminders. Blank vendor/contact details
and payment dates are not guessed. The importer expects the provided workbook's
two-block layout; it is not a general Excel importer.

Summary discrepancies are flagged. **MONTHLY INSTALLMENTS** rows are excluded by
default, with workbook statuses visible. Select only confirmed unpaid schedules;
correct suggested amounts and dates before importing. Completed installments must
not be entered again on top of the opening paid balances. The spreadsheet itself
is not uploaded. Confirmed records and its SHA-256 fingerprint/filename are saved;
repeat import of that file is rejected. Import into an existing expense ledger is
disabled to avoid duplication. No vendor names or payment dates are inferred.

## Validation and deployment

From `frontend/`: `npm run build`.

From `backend/`: `.venv/Scripts/python.exe scripts/test_isolated.py -q` runs the
complete pytest suite against in-memory SQLite without contacting MySQL. It
emulates only the health endpoint's MySQL introspection functions. This covers
RSVP regression tests and planner calculations, API permissions, audit logging,
revision conflicts, validation, and migration upgrade/downgrade. It does not prove
MySQL server compatibility; validate the migration in staging before production.

Deploy the backend with Alembic revision `f8b2d4e6a901` before the new frontend.
The existing Render startup migration command applies it during deployment.
There are no changes to public RSVP endpoints or existing database tables.
After rollout, sign in, import/reconcile the workbook, then verify saving and
refresh. No production records should be inserted by test scripts.
