from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Money = Annotated[int, Field(strict=True, ge=0, le=100_000_000_000)]
Identifier = Annotated[str, Field(min_length=1, max_length=80)]
Name = Annotated[str, Field(min_length=1, max_length=200)]
Notes = Annotated[str, Field(max_length=2000)]
MANILA = timezone(timedelta(hours=8), "Asia/Manila")


class PlannerModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Category(PlannerModel):
    id: Identifier
    name: Name
    budget: Money | None = None


class Vendor(PlannerModel):
    id: Identifier
    name: Name
    service: Annotated[str, Field(max_length=200)] = ""
    contact: Annotated[str, Field(max_length=500)] = ""
    notes: Notes = ""


class Expense(PlannerModel):
    id: Identifier
    category_id: Identifier
    vendor_id: Identifier | None = None
    name: Name
    estimate: Money | None = None
    actual: Money | None = None
    due_date: date | None = None
    notes: Notes = ""
    payment_arrangement: Literal["flexible", "installment"] = "flexible"


class Installment(PlannerModel):
    id: Identifier
    expense_id: Identifier
    name: Name
    amount: Annotated[int, Field(strict=True, gt=0, le=100_000_000_000)]
    due_date: date
    cancelled: bool = False


class Payment(PlannerModel):
    id: Identifier
    expense_id: Identifier
    installment_id: Identifier | None = None
    amount: Annotated[int, Field(strict=True, gt=0, le=100_000_000_000)]
    paid_date: date | None = None
    reference: Annotated[str, Field(max_length=200)] = ""
    notes: Notes = ""


class ChecklistItem(PlannerModel):
    id: Identifier
    name: Annotated[str, Field(min_length=1, max_length=500)]
    due_date: date | None = None
    completed: bool = False
    notes: Notes = ""


class ImportSource(PlannerModel):
    fingerprint: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    name: Name


class PlannerDocument(PlannerModel):
    categories: list[Category] = Field(default_factory=list, max_length=100)
    vendors: list[Vendor] = Field(default_factory=list, max_length=1000)
    expenses: list[Expense] = Field(default_factory=list, max_length=2000)
    installments: list[Installment] = Field(default_factory=list, max_length=4000)
    payments: list[Payment] = Field(default_factory=list, max_length=8000)
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=2000)
    imports: list[ImportSource] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_ledger(self) -> Self:
        for field in (
            "categories",
            "vendors",
            "expenses",
            "installments",
            "payments",
            "checklist",
        ):
            values = getattr(self, field)
            if len({item.id for item in values}) != len(values):
                raise ValueError(f"Duplicate identifiers in {field}.")
        if len({item.fingerprint for item in self.imports}) != len(self.imports):
            raise ValueError("This workbook has already been imported.")
        categories = {item.id for item in self.categories}
        vendors = {item.id for item in self.vendors}
        expenses = {item.id: item for item in self.expenses}
        installments = {item.id: item for item in self.installments}
        paid: dict[str, int] = {}
        scheduled: dict[str, int] = {}
        installment_paid: dict[str, int] = {}
        for expense in self.expenses:
            if expense.category_id not in categories:
                raise ValueError("Expense category does not exist.")
            if expense.vendor_id and expense.vendor_id not in vendors:
                raise ValueError("Expense vendor does not exist.")
        for item in self.installments:
            if item.expense_id not in expenses:
                raise ValueError("Installment expense does not exist.")
            scheduled[item.expense_id] = scheduled.get(item.expense_id, 0) + item.amount
        for payment in self.payments:
            if payment.expense_id not in expenses:
                raise ValueError("Payment expense does not exist.")
            if payment.paid_date and payment.paid_date > datetime.now(MANILA).date():
                raise ValueError(
                    "Future payments belong in installments, not paid history."
                )
            paid[payment.expense_id] = paid.get(payment.expense_id, 0) + payment.amount
            if payment.installment_id:
                item = installments.get(payment.installment_id)
                if item is None or item.expense_id != payment.expense_id:
                    raise ValueError("Payment installment does not match its expense.")
                installment_paid[item.id] = (
                    installment_paid.get(item.id, 0) + payment.amount
                )
        for item in self.installments:
            if installment_paid.get(item.id, 0) > item.amount:
                raise ValueError("Payments exceed the installment amount.")
        for expense in self.expenses:
            cost = expense.actual if expense.actual is not None else expense.estimate
            total_paid = paid.get(expense.id, 0)
            remaining_schedule = sum(
                item.amount - installment_paid.get(item.id, 0)
                for item in self.installments
                if item.expense_id == expense.id and not item.cancelled
            )
            if total_paid or scheduled.get(expense.id, 0):
                if cost is None:
                    raise ValueError(
                        "Set an expense cost before recording payments or installments."
                    )
                if total_paid + remaining_schedule > cost:
                    raise ValueError(
                        "Payments and unpaid installments exceed the expense cost."
                    )
        return self


class PlannerSaveRequest(PlannerModel):
    revision: Annotated[int, Field(ge=0)]
    document: PlannerDocument
