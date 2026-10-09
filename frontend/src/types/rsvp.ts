export type GuestStatus = "invited" | "verified" | "blocked";

export type RSVPStatus = "pending" | "attending" | "not_attending";

export type AttendanceType =
  | "ceremony_and_reception"
  | "ceremony_only"
  | "reception_only";

export type MealPreference =
  | "standard"
  | "vegetarian"
  | "vegan"
  | "halal"
  | "other";

export type GuestSummary = {
  id: number;
  invitation_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  household_name: string | null;
  maximum_companions: number;
  is_primary_guest: boolean;
  status: GuestStatus;
  created_at: string;
  updated_at: string;
};

export type GuestVerificationResponse = {
  success: boolean;
  guest: GuestSummary;
  has_existing_rsvp: boolean;
};

export type CompanionInput = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
};

export type RSVPSubmissionRequest = {
  invitation_code: string;
  status: RSVPStatus;
  attendance_type: AttendanceType | null;
  meal_preference?: MealPreference | null;
  dietary_restrictions: string | null;
  guest_message: string | null;
  companions?: CompanionInput[];
};

export type CompanionResponse = CompanionInput & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type RSVPResponse = {
  id: number;
  guest_id: number;
  status: RSVPStatus;
  attendance_type: AttendanceType | null;
  companion_count: number;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  guest_message: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  companions: CompanionResponse[];
};

export type RSVPSubmissionResponse = {
  success: boolean;
  message: string;
  rsvp: RSVPResponse;
};
