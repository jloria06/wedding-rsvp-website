import csv
import io
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AttendanceType,
    Guest,
    GuestStatus,
    RSVP,
    RSVPStatus,
    SeatAssignment,
)
from app.schemas.admin_reports import (
    AdminReportSummaryResponse,
    ReportBreakdownItem,
)


class AdminReportsService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_summary(self) -> AdminReportSummaryResponse:
        guests = self._guests()
        active_guests = [guest for guest in guests if guest.status != GuestStatus.BLOCKED]
        responded = [
            guest
            for guest in active_guests
            if guest.rsvp is not None
            and guest.rsvp.status in (RSVPStatus.ATTENDING, RSVPStatus.NOT_ATTENDING)
        ]
        attending = [
            guest
            for guest in active_guests
            if guest.rsvp is not None and guest.rsvp.status == RSVPStatus.ATTENDING
        ]
        declined = [
            guest
            for guest in active_guests
            if guest.rsvp is not None and guest.rsvp.status == RSVPStatus.NOT_ATTENDING
        ]

        attendance_counts: Counter[str] = Counter()
        meal_counts: Counter[str] = Counter()
        age_counts: Counter[str] = Counter(guest.age_group.value for guest in active_guests)
        attending_people = 0
        companions_attending = 0
        ceremony_people = 0
        reception_people = 0
        assigned_reception_people = 0
        dietary_requests = 0

        for guest in attending:
            rsvp = guest.rsvp
            if rsvp is None:
                continue
            party_size = 1 + len(rsvp.companions)
            attending_people += party_size
            companions_attending += len(rsvp.companions)
            attendance_label = (
                rsvp.attendance_type.value
                if rsvp.attendance_type is not None
                else "not_provided"
            )
            attendance_counts[attendance_label] += party_size

            if rsvp.attendance_type in (
                AttendanceType.CEREMONY_AND_RECEPTION,
                AttendanceType.CEREMONY_ONLY,
            ):
                ceremony_people += party_size
            if rsvp.attendance_type in (
                AttendanceType.CEREMONY_AND_RECEPTION,
                AttendanceType.RECEPTION_ONLY,
            ):
                reception_people += party_size
                if guest.seat_assignment is not None:
                    assigned_reception_people += party_size

            meal_counts[
                rsvp.meal_preference.value if rsvp.meal_preference else "not_provided"
            ] += 1
            if self._has_text(rsvp.dietary_restrictions):
                dietary_requests += 1
            for companion in rsvp.companions:
                meal_counts[
                    companion.meal_preference.value
                    if companion.meal_preference
                    else "not_provided"
                ] += 1
                if self._has_text(companion.dietary_restrictions):
                    dietary_requests += 1

        total = len(active_guests)
        pending = total - len(responded)
        unassigned_reception_people = reception_people - assigned_reception_people
        return AdminReportSummaryResponse(
            total_invitations=total,
            responded_invitations=len(responded),
            pending_invitations=pending,
            attending_invitations=len(attending),
            declined_invitations=len(declined),
            attending_people=attending_people,
            companions_attending=companions_attending,
            ceremony_people=ceremony_people,
            reception_people=reception_people,
            dietary_requests=dietary_requests,
            response_rate=self._percentage(len(responded), total),
            assigned_reception_people=assigned_reception_people,
            unassigned_reception_people=unassigned_reception_people,
            seating_completion_rate=self._percentage(
                assigned_reception_people, reception_people
            ),
            attendance_breakdown=self._breakdown(attendance_counts),
            meal_breakdown=self._breakdown(meal_counts),
            age_breakdown=self._breakdown(age_counts),
        )

    def export_csv(self) -> str:
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(
            [
                "Invitation Code",
                "Guest",
                "Household",
                "Guest Status",
                "RSVP Status",
                "Attendance",
                "Party Size",
                "Companions",
                "Guest Meal",
                "Dietary Requests",
                "Reception Table",
                "Responded At",
            ]
        )
        for guest in self._guests():
            rsvp = guest.rsvp
            companions = list(rsvp.companions) if rsvp else []
            dietary = []
            if rsvp and self._has_text(rsvp.dietary_restrictions):
                dietary.append(f"{guest.full_name}: {rsvp.dietary_restrictions.strip()}")
            for companion in companions:
                if self._has_text(companion.dietary_restrictions):
                    dietary.append(
                        f"{companion.full_name}: {companion.dietary_restrictions.strip()}"
                    )
            writer.writerow(
                [
                    guest.invitation_code,
                    guest.full_name,
                    guest.household_name or "",
                    guest.status.value,
                    rsvp.status.value if rsvp else RSVPStatus.PENDING.value,
                    rsvp.attendance_type.value if rsvp and rsvp.attendance_type else "",
                    1 + len(companions) if rsvp and rsvp.status == RSVPStatus.ATTENDING else 0,
                    "; ".join(companion.full_name for companion in companions),
                    rsvp.meal_preference.value if rsvp and rsvp.meal_preference else "",
                    "; ".join(dietary),
                    (
                        guest.seat_assignment.table.name
                        if guest.seat_assignment is not None
                        else ""
                    ),
                    rsvp.responded_at.isoformat() if rsvp and rsvp.responded_at else "",
                ]
            )
        return output.getvalue()

    def _guests(self) -> list[Guest]:
        return list(
            self.database_session.scalars(
                select(Guest)
                .where(Guest.deleted_at.is_(None))
                .options(
                    selectinload(Guest.rsvp).selectinload(RSVP.companions),
                    selectinload(Guest.seat_assignment).selectinload(
                        SeatAssignment.table
                    ),
                )
                .order_by(Guest.last_name, Guest.first_name, Guest.id)
            ).all()
        )

    @staticmethod
    def _percentage(numerator: int, denominator: int) -> float:
        if denominator == 0:
            return 0.0
        return round((numerator / denominator) * 100, 1)

    @staticmethod
    def _has_text(value: str | None) -> bool:
        return bool(value and value.strip())

    @staticmethod
    def _breakdown(counter: Counter[str]) -> list[ReportBreakdownItem]:
        return [
            ReportBreakdownItem(label=label, value=value)
            for label, value in sorted(counter.items())
        ]
