from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Administrator


class AdministratorRepository:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_by_id(
        self,
        administrator_id: int,
    ) -> Administrator | None:
        statement = select(Administrator).where(
            Administrator.id == administrator_id,
        )

        return self.database_session.scalar(statement)

    def get_by_username(
        self,
        username: str,
    ) -> Administrator | None:
        normalized_username = username.strip().lower()

        statement = select(Administrator).where(
            Administrator.username == normalized_username,
        )

        return self.database_session.scalar(statement)

    def get_by_login(
        self,
        login: str,
    ) -> Administrator | None:
        normalized_login = login.strip().lower()

        statement = select(Administrator).where(
            or_(
                Administrator.username == normalized_login,
                Administrator.email == normalized_login,
            )
        )

        return self.database_session.scalar(statement)

    def add(
        self,
        administrator: Administrator,
    ) -> Administrator:
        administrator.username = administrator.username.strip().lower()
        administrator.email = administrator.email.strip().lower()

        self.database_session.add(administrator)
        self.database_session.flush()

        return administrator
