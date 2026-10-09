export type AdminRole = "super_admin" | "admin" | "viewer";

export type AdminProfile = {
  success: boolean;
  administrator_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  status: string;
  is_password_change_required: boolean;
};

export type AdminLoginResponse = {
  success: boolean;
  message: string;
  administrator_id: number;
  username: string;
  role: AdminRole;
  is_password_change_required: boolean;
  access_token: string;
  token_type: "bearer";
};

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type DashboardStatistics = {
  success: boolean;
  total_guests: number;
  allocated_seats: number;
  rsvp_responses: number;
  attending: number;
  declined: number;
  pending: number;
  adults: number | null;
  children: number | null;
};

export type AgeGroup = "adult" | "child";
export type GuestStatus = "invited" | "verified" | "blocked";
export type RSVPStatus = "pending" | "attending" | "not_attending";
export type AttendanceType = "ceremony_and_reception" | "ceremony_only" | "reception_only";
export type MealPreference = "standard" | "vegetarian" | "vegan" | "halal" | "other";

export type AdminCompanion = {
  id?: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
};

export type AdminRSVP = {
  guest_id: number;
  invitation_code: string;
  guest_name: string;
  household_name: string | null;
  maximum_companions: number;
  rsvp_id: number | null;
  status: RSVPStatus;
  attendance_type: AttendanceType | null;
  companion_count: number;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  guest_message: string | null;
  responded_at: string | null;
  companions: AdminCompanion[];
};

export type RSVPInput = {
  status: RSVPStatus;
  attendance_type: AttendanceType | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  guest_message: string | null;
  companions: AdminCompanion[];
};

export type AdminGuest = {
  id: number;
  invitation_code: string;
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  household_name: string | null;
  maximum_companions: number;
  age_group: AgeGroup;
  is_primary_guest: boolean;
  status: GuestStatus;
  rsvp_status: RSVPStatus | null;
  created_at: string;
};

export type GuestInput = {
  invitation_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  household_name: string | null;
  maximum_companions: number;
  age_group: AgeGroup;
  is_primary_guest: boolean;
};

export type GuestUpdate = Omit<GuestInput, "invitation_code"> & {
  status: GuestStatus;
};

export type SeatingParty = {
  guest_id: number;
  invitation_code: string;
  guest_name: string;
  household_name: string | null;
  party_size: number;
  companion_names: string[];
};

export type SeatingAssignment = SeatingParty & {
  assignment_id: number;
  assigned_at: string;
};

export type SeatingTable = {
  id: number;
  name: string;
  capacity: number;
  notes: string | null;
  assigned_seats: number;
  remaining_seats: number;
  assignments: SeatingAssignment[];
};

export type SeatingOverview = {
  success: boolean;
  tables: SeatingTable[];
  unassigned_parties: SeatingParty[];
  total_capacity: number;
  assigned_seats: number;
  remaining_seats: number;
};

export type SeatingMutationResponse = {
  success: boolean;
  message: string;
  seating: SeatingOverview;
};

export type ReportBreakdownItem = {
  label: string;
  value: number;
};

export type AdminReportSummary = {
  success: boolean;
  total_invitations: number;
  responded_invitations: number;
  pending_invitations: number;
  attending_invitations: number;
  declined_invitations: number;
  attending_people: number;
  companions_attending: number;
  ceremony_people: number;
  reception_people: number;
  dietary_requests: number;
  response_rate: number;
  assigned_reception_people: number;
  unassigned_reception_people: number;
  seating_completion_rate: number;
  attendance_breakdown: ReportBreakdownItem[];
  meal_breakdown: ReportBreakdownItem[];
  age_breakdown: ReportBreakdownItem[];
};
