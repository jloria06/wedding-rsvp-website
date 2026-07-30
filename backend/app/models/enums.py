from enum import StrEnum


class GuestStatus(StrEnum):
    INVITED = "invited"
    VERIFIED = "verified"
    BLOCKED = "blocked"


class RSVPStatus(StrEnum):
    PENDING = "pending"
    ATTENDING = "attending"
    NOT_ATTENDING = "not_attending"


class AttendanceType(StrEnum):
    CEREMONY_AND_RECEPTION = "ceremony_and_reception"
    CEREMONY_ONLY = "ceremony_only"
    RECEPTION_ONLY = "reception_only"


class MealPreference(StrEnum):
    STANDARD = "standard"
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    HALAL = "halal"
    OTHER = "other"


class AdminRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    VIEWER = "viewer"


class AdminStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
