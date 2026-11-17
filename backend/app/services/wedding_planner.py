from datetime import date, datetime

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ApplicationError, ConflictError
from app.models import WeddingPlanner
from app.schemas.wedding_planner import MANILA, PlannerDocument, PlannerSaveRequest

CATEGORY_NAMES = (
    "Apparel",
    "Flowers",
    "Photography / Video",
    "Rings",
    "Misc",
    "Ceremony",
    "Reception",
    "Gifts & Favors",
    "Stationary",
    "Honeymoon",
)


def default_document() -> PlannerDocument:
    return PlannerDocument(
        categories=[
            {"id": f"category-{index}", "name": name}
            for index, name in enumerate(CATEGORY_NAMES)
        ]
    )


def summarize(document: PlannerDocument, today: date | None = None) -> dict:
    today = today or datetime.now(MANILA).date()
    paid = {item.id: 0 for item in document.expenses}
    installment_paid = {item.id: 0 for item in document.installments}
    for payment in document.payments:
        paid[payment.expense_id] += payment.amount
        if payment.installment_id:
            installment_paid[payment.installment_id] += payment.amount
    by_expense = {}
    due = []
    for expense in document.expenses:
        # The legacy response key now contains actual cost only.
        forecast = expense.actual
        balance = None if forecast is None else forecast - paid[expense.id]
        by_expense[expense.id] = {
            "forecast": forecast,
            "paid": paid[expense.id],
            "balance": balance,
        }
        if forecast is None:
            continue
        scheduled_balance = 0
        for installment in document.installments:
            if installment.expense_id != expense.id or installment.cancelled:
                continue
            amount = installment.amount - installment_paid[installment.id]
            scheduled_balance += amount
            if amount:
                due.append(
                    {
                        "expense_id": expense.id,
                        "name": expense.name,
                        "label": installment.name,
                        "amount": amount,
                        "due_date": installment.due_date.isoformat(),
                    }
                )
        unscheduled = (balance or 0) - scheduled_balance
        if unscheduled:
            due.append(
                {
                    "expense_id": expense.id,
                    "name": expense.name,
                    "label": "Unscheduled balance",
                    "amount": unscheduled,
                    "due_date": expense.due_date.isoformat()
                    if expense.due_date
                    else None,
                }
            )
        by_expense[expense.id] = {
            "forecast": forecast,
            "paid": paid[expense.id],
            "balance": balance,
        }
    monthly: dict[str, int] = {}
    for item in due:
        month = item["due_date"][:7] if item["due_date"] else "Undated"
        monthly[month] = monthly.get(month, 0) + item["amount"]
    categories = []
    for category in document.categories:
        items = [
            by_expense[e.id] for e in document.expenses if e.category_id == category.id
        ]
        forecast = sum(item["forecast"] or 0 for item in items)
        categories.append(
            {
                "id": category.id,
                "name": category.name,
                "budget": None,
                "forecast": forecast,
                "paid": sum(item["paid"] for item in items),
                "balance": sum(item["balance"] or 0 for item in items),
                "variance": None,
                "unestimated": sum(item["forecast"] is None for item in items),
            }
        )
    forecast = sum(item["forecast"] or 0 for item in by_expense.values())
    total_paid = sum(paid.values())
    return {
        "budget": None,
        "forecast": forecast,
        "paid": total_paid,
        "balance": sum(item["balance"] or 0 for item in by_expense.values()),
        "unestimated": sum(item["forecast"] is None for item in by_expense.values()),
        "unbudgeted": 0,
        "overdue": sum(
            item["amount"]
            for item in due
            if item["due_date"] and item["due_date"] < today.isoformat()
        ),
        "as_of": today.isoformat(),
        "categories": categories,
        "expenses": by_expense,
        "monthly": [
            {"month": month, "amount": monthly[month]} for month in sorted(monthly)
        ],
        "due": sorted(due, key=lambda item: item["due_date"] or "9999"),
    }


class WeddingPlannerService:
    def __init__(self, session: Session):
        self.session = session

    def read(self) -> dict:
        record = self.session.get(WeddingPlanner, 1)
        document = (
            PlannerDocument.model_validate(record.document)
            if record
            else default_document()
        )
        return {
            "revision": record.revision if record else 0,
            "document": document.model_dump(mode="json"),
            "summary": summarize(document),
        }

    def save(self, request: PlannerSaveRequest, administrator_id: int) -> dict:
        previous = self.session.get(WeddingPlanner, 1)
        conflict = "The planner changed in another session. Reload before saving again."
        if request.revision != (previous.revision if previous else 0):
            raise ConflictError(conflict)
        old_document = previous.document if previous else {}
        # Legacy estimate-only records remain readable and editable. New financial
        # activity (or clearing a known price) requires an actual price first.
        old_expenses = {e["id"]: e for e in old_document.get("expenses", [])}
        for expense in request.document.expenses:
            if expense.actual is not None:
                continue
            payments = [
                p for p in request.document.payments if p.expense_id == expense.id
            ]
            installments = [
                i
                for i in request.document.installments
                if i.expense_id == expense.id and not i.cancelled
            ]
            if not payments and not installments:
                continue
            old_expense = old_expenses.get(expense.id)
            unchanged = old_expense is not None and old_expense.get("actual") is None
            for records, key, fields in (
                (payments, "payments", ("amount", "expense_id", "installment_id")),
                (installments, "installments", ("amount", "expense_id", "due_date")),
            ):
                old_records = {item["id"]: item for item in old_document.get(key, [])}
                for item in records:
                    old = old_records.get(item.id)
                    values = item.model_dump(mode="json")
                    if old is None or any(
                        values.get(field) != old.get(field) for field in fields
                    ):
                        unchanged = False
            if not unchanged:
                raise ApplicationError(
                    f"Set the actual price for {expense.name} "
                    "before changing payments or installments.",
                    status_code=422,
                )
        document = request.document.model_dump(mode="json")
        if request.revision == 0:
            try:
                self.session.add(
                    WeddingPlanner(
                        id=1,
                        revision=1,
                        document=document,
                        updated_by_id=administrator_id,
                    )
                )
                self.session.flush()
            except IntegrityError as error:
                self.session.rollback()
                raise ConflictError(conflict) from error
        else:
            result = self.session.execute(
                update(WeddingPlanner)
                .where(
                    WeddingPlanner.id == 1, WeddingPlanner.revision == request.revision
                )
                .values(
                    document=document,
                    revision=request.revision + 1,
                    updated_by_id=administrator_id,
                )
            )
            if result.rowcount != 1:
                raise ConflictError(conflict)
        return {
            "revision": request.revision + 1,
            "document": document,
            "summary": summarize(request.document),
        }
