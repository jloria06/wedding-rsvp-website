from datetime import date, datetime

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
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
        forecast = expense.actual if expense.actual is not None else expense.estimate
        balance = None if forecast is None else forecast - paid[expense.id]
        scheduled_balance = 0
        for installment in document.installments:
            if installment.expense_id != expense.id:
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
                "budget": category.budget,
                "forecast": forecast,
                "paid": sum(item["paid"] for item in items),
                "balance": sum(item["balance"] or 0 for item in items),
                "variance": None
                if category.budget is None
                else category.budget - forecast,
                "unestimated": sum(item["forecast"] is None for item in items),
            }
        )
    forecast = sum(item["forecast"] or 0 for item in by_expense.values())
    total_paid = sum(paid.values())
    budgets = [c.budget for c in document.categories if c.budget is not None]
    return {
        "budget": sum(budgets) if budgets else None,
        "forecast": forecast,
        "paid": total_paid,
        "balance": forecast - total_paid,
        "unestimated": sum(item["forecast"] is None for item in by_expense.values()),
        "unbudgeted": sum(c.budget is None for c in document.categories),
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
        document = request.document.model_dump(mode="json")
        conflict = "The planner changed in another session. Reload before saving again."
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
