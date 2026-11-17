from copy import deepcopy
from datetime import date
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.admin.planner import router
from app.core.exception_handlers import register_exception_handlers
from app.core.exceptions import ConflictError
from app.database.base import Base
from app.database.session import get_database_session
from app.models import Administrator, AdminRole, AdminStatus, AuditLog, WeddingPlanner
from app.schemas.wedding_planner import PlannerDocument, PlannerSaveRequest
from app.security.admin_context import get_current_administrator
from app.services.wedding_planner import WeddingPlannerService, summarize


def ledger() -> dict:
    return {
        "categories": [{"id": "reception", "name": "Reception", "budget": 150000}],
        "vendors": [{"id": "vendor", "name": "Test supplier"}],
        "expenses": [
            {
                "id": "venue",
                "name": "Venue",
                "category_id": "reception",
                "vendor_id": "vendor",
                "estimate": 120000,
                "actual": 100001,
                "due_date": "2027-03-20",
            },
            {
                "id": "cake",
                "name": "Cake",
                "category_id": "reception",
                "estimate": 20000,
            },
            {"id": "flowers", "name": "Flowers", "category_id": "reception"},
        ],
        "installments": [
            {
                "id": "deposit",
                "expense_id": "venue",
                "name": "Deposit",
                "amount": 30000,
                "due_date": "2026-11-01",
            }
        ],
        "payments": [
            {
                "id": "payment",
                "expense_id": "venue",
                "installment_id": "deposit",
                "amount": 10000,
                "paid_date": "2026-10-01",
            }
        ],
    }


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def test_forecast_uses_agreed_cost_and_does_not_double_count_installments():
    summary = summarize(PlannerDocument.model_validate(ledger()), date(2026, 11, 17))
    assert summary["forecast"] == 120001
    assert summary["paid"] == 10000
    assert summary["balance"] == 110001
    assert summary["overdue"] == 20000
    assert summary["unestimated"] == 1
    assert summary["categories"][0]["variance"] == 29999
    assert summary["monthly"] == [
        {"month": "2026-11", "amount": 20000},
        {"month": "2027-03", "amount": 70001},
        {"month": "Undated", "amount": 20000},
    ]
    assert sum(row["amount"] for row in summary["due"]) == summary["balance"]


def test_unknown_budget_stays_unknown_and_zero_cost_is_known():
    data = ledger()
    data["categories"][0]["budget"] = None
    data["expenses"][2]["actual"] = 0
    summary = summarize(PlannerDocument.model_validate(data))
    assert summary["budget"] is None
    assert summary["categories"][0]["variance"] is None
    assert summary["unestimated"] == 0


def test_flexible_default_and_cancelled_schedule_preserve_payment_totals():
    data = ledger()
    data["installments"][0]["cancelled"] = True
    document = PlannerDocument.model_validate(data)
    assert document.expenses[0].payment_arrangement == "flexible"
    summary = summarize(document, date(2026, 11, 17))
    assert summary["paid"] == 10000
    assert summary["balance"] == 110001
    assert summary["overdue"] == 0
    assert sum(row["amount"] for row in summary["due"]) == 110001
    assert len(document.payments) == 1


def test_installment_arrangement_roundtrips_and_rejects_invalid_choice():
    data = ledger()
    data["expenses"][0]["payment_arrangement"] = "installment"
    document = PlannerDocument.model_validate(data)
    assert document.model_dump()["expenses"][0]["payment_arrangement"] == "installment"
    data["expenses"][0]["payment_arrangement"] = "invalid"
    with pytest.raises(ValidationError):
        PlannerDocument.model_validate(data)


def test_settling_installment_updates_expense_without_changing_forecast():
    data = ledger()
    data["payments"].append(
        {
            "id": "second",
            "expense_id": "venue",
            "installment_id": "deposit",
            "amount": 20000,
        }
    )
    summary = summarize(PlannerDocument.model_validate(data), date(2026, 11, 17))
    assert summary["forecast"] == 120001
    assert summary["paid"] == 30000
    assert summary["balance"] == 90001
    assert summary["overdue"] == 0


@pytest.mark.parametrize(
    "case",
    [
        "overpaid",
        "schedule",
        "orphan",
        "mismatch",
        "negative",
        "fraction",
        "duplicate",
        "unknown-cost",
        "future",
    ],
)
def test_invalid_financial_records_are_rejected(case):
    data = ledger()
    if case == "overpaid":
        data["payments"][0]["amount"] = 200000
    elif case == "schedule":
        data["installments"][0]["amount"] = 200000
    elif case == "orphan":
        data["expenses"][0]["vendor_id"] = "missing"
    elif case == "mismatch":
        data["payments"][0]["expense_id"] = "cake"
    elif case == "negative":
        data["expenses"][0]["actual"] = -1
    elif case == "fraction":
        data["payments"][0]["amount"] = 1.1
    elif case == "duplicate":
        data["payments"].append(deepcopy(data["payments"][0]))
    elif case == "unknown-cost":
        data["expenses"][0]["actual"] = None
        data["expenses"][0]["estimate"] = None
    elif case == "future":
        data["payments"][0]["paid_date"] = "2099-01-01"
    with pytest.raises(ValidationError):
        PlannerDocument.model_validate(data)


def test_first_save_can_be_rolled_back_before_audit_commit(session):
    service = WeddingPlannerService(session)
    request = PlannerSaveRequest(
        revision=0, document=PlannerDocument.model_validate(ledger())
    )
    service.save(request, 1)
    session.rollback()
    assert session.get(WeddingPlanner, 1) is None


def test_planner_persists_and_rejects_stale_and_duplicate_initial_saves(session):
    service = WeddingPlannerService(session)
    assert service.read()["revision"] == 0
    assert session.get(WeddingPlanner, 1) is None
    request = PlannerSaveRequest(
        revision=0, document=PlannerDocument.model_validate(ledger())
    )
    saved = service.save(request, 1)
    session.commit()
    assert saved["revision"] == 1
    with pytest.raises(ConflictError):
        service.save(request, 1)
    updated = service.save(request.model_copy(update={"revision": 1}), 1)
    session.commit()
    assert updated["revision"] == 2
    with pytest.raises(ConflictError):
        service.save(request.model_copy(update={"revision": 1}), 1)
    session.expire_all()
    assert service.read()["revision"] == 2
    assert service.read()["summary"]["balance"] == 110001


def test_api_requires_auth_viewer_is_read_only_and_writes_are_audited(session):
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router, prefix="/api/admin")
    app.dependency_overrides[get_database_session] = lambda: session
    client = TestClient(app)
    assert client.get("/api/admin/planner").status_code == 403
    administrator = Administrator(
        username="planner",
        email="planner@example.invalid",
        password_hash="unused",
        first_name="Test",
        last_name="Admin",
        role=AdminRole.VIEWER,
        status=AdminStatus.ACTIVE,
        is_password_change_required=False,
    )
    session.add(administrator)
    session.commit()
    app.dependency_overrides[get_current_administrator] = lambda: administrator
    response = client.get("/api/admin/planner")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    request = {"revision": 0, "document": ledger()}
    assert client.put("/api/admin/planner", json=request).status_code == 403
    administrator.role = AdminRole.ADMIN
    response = client.put("/api/admin/planner", json=request)
    assert response.status_code == 200
    assert response.json()["summary"]["paid"] == 10000
    assert session.scalar(select(AuditLog)).action == "planner.updated"
    assert client.put("/api/admin/planner", json=request).status_code == 409
    request["revision"] = 1
    request["document"]["payments"][0]["amount"] = 999999
    assert client.put("/api/admin/planner", json=request).status_code == 422
    assert client.get("/api/admin/planner").json()["revision"] == 1
    administrator.is_password_change_required = True
    assert client.get("/api/admin/planner").status_code == 403


def test_migration_creates_and_removes_only_planner_table():
    path = (
        Path(__file__).parents[1]
        / "alembic/versions/f8b2d4e6a901_add_wedding_planner.py"
    )
    spec = spec_from_file_location("planner_migration", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE administrators (id INTEGER PRIMARY KEY)"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert set(inspect(connection).get_table_names()) == {
                "administrators",
                "wedding_planner",
            }
            assert {
                c["name"] for c in inspect(connection).get_columns("wedding_planner")
            } == {
                "id",
                "revision",
                "document",
                "updated_by_id",
                "created_at",
                "updated_at",
            }
            migration.downgrade()
            assert inspect(connection).get_table_names() == ["administrators"]
