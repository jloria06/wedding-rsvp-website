import { apiRequest } from "../lib/api";
import type {
  GuestVerificationResponse,
  RSVPSubmissionRequest,
  RSVPSubmissionResponse,
} from "../types/rsvp";

export function verifyInvitationCode(
  invitationCode: string,
): Promise<GuestVerificationResponse> {
  return apiRequest<GuestVerificationResponse>("/guests/verify", {
    method: "POST",
    body: JSON.stringify({
      invitation_code: invitationCode,
    }),
  });
}

export function submitRSVP(
  request: RSVPSubmissionRequest,
): Promise<RSVPSubmissionResponse> {
  return apiRequest<RSVPSubmissionResponse>("/rsvps", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
