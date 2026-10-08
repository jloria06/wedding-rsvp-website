import { apiDownload, apiRequest, apiUpload } from "../lib/api";
import type {
  AdminLoginResponse,
  AdminProfile,
  DashboardStatistics,
  AdminGuest,
  GuestInput,
  GuestUpdate,
  MessageResponse,
  AdminRSVP,
  RSVPInput,
  SeatingMutationResponse,
  SeatingOverview,
} from "./types";
import type { WeddingContent } from "../types/content";

export const adminTokenStorageKey = "wedding-rsvp-admin-token";

export function loginAdministrator(
  username: string,
  password: string,
): Promise<AdminLoginResponse> {
  return apiRequest<AdminLoginResponse>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getAdministratorProfile(
  accessToken: string,
): Promise<AdminProfile> {
  return apiRequest<AdminProfile>("/admin/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function changeAdministratorPassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/admin/auth/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export function getDashboardStatistics(
  accessToken: string,
): Promise<DashboardStatistics> {
  return apiRequest<DashboardStatistics>("/admin/dashboard/statistics", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

type GuestListResponse = { success: boolean; guests: AdminGuest[]; total: number };
type GuestMutationResponse = { success: boolean; message: string; guest: AdminGuest };

export function listAdministratorGuests(accessToken: string): Promise<GuestListResponse> {
  return apiRequest<GuestListResponse>("/admin/guests", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function createAdministratorGuest(
  accessToken: string,
  guest: GuestInput,
): Promise<GuestMutationResponse> {
  return apiRequest<GuestMutationResponse>("/admin/guests", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(guest),
  });
}

export function updateAdministratorGuest(
  accessToken: string,
  guestId: number,
  guest: GuestUpdate,
): Promise<GuestMutationResponse> {
  return apiRequest<GuestMutationResponse>(`/admin/guests/${guestId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(guest),
  });
}

export function deactivateAdministratorGuest(
  accessToken: string,
  guestId: number,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/admin/guests/${guestId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

type RSVPListResponse = { success: boolean; rsvps: AdminRSVP[]; total: number };
type RSVPMutationResponse = { success: boolean; message: string; rsvp: AdminRSVP };

export function listAdministratorRsvps(accessToken: string): Promise<RSVPListResponse> {
  return apiRequest<RSVPListResponse>("/admin/rsvps", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function saveAdministratorRsvp(
  accessToken: string,
  guestId: number,
  rsvp: RSVPInput,
): Promise<RSVPMutationResponse> {
  return apiRequest<RSVPMutationResponse>(`/admin/rsvps/${guestId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(rsvp),
  });
}

export function exportAdministratorRsvps(accessToken: string): Promise<Blob> {
  return apiDownload("/admin/rsvps/export.csv", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

type WeddingContentResponse = { success: boolean; content: WeddingContent };

export function getAdministratorContent(accessToken: string): Promise<WeddingContentResponse> {
  return apiRequest<WeddingContentResponse>("/admin/content", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function updateAdministratorContent(
  accessToken: string,
  content: WeddingContent,
): Promise<WeddingContentResponse> {
  return apiRequest<WeddingContentResponse>("/admin/content", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(content),
  });
}

export type MediaUploadResponse = {
  success: boolean;
  id: number;
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export function uploadAdministratorMedia(
  accessToken: string,
  file: File,
): Promise<MediaUploadResponse> {
  return apiUpload<MediaUploadResponse>("/admin/content/media", file, accessToken);
}

export function getAdministratorSeating(accessToken: string): Promise<SeatingOverview> {
  return apiRequest<SeatingOverview>("/admin/seating", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function createAdministratorTable(
  accessToken: string,
  table: { name: string; capacity: number; notes: string | null },
): Promise<SeatingMutationResponse> {
  return apiRequest<SeatingMutationResponse>("/admin/seating/tables", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(table),
  });
}

export function updateAdministratorTable(
  accessToken: string,
  tableId: number,
  table: { name: string; capacity: number; notes: string | null },
): Promise<SeatingMutationResponse> {
  return apiRequest<SeatingMutationResponse>(`/admin/seating/tables/${tableId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(table),
  });
}

export function deleteAdministratorTable(
  accessToken: string,
  tableId: number,
): Promise<SeatingMutationResponse> {
  return apiRequest<SeatingMutationResponse>(`/admin/seating/tables/${tableId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function assignAdministratorParty(
  accessToken: string,
  guestId: number,
  tableId: number,
): Promise<SeatingMutationResponse> {
  return apiRequest<SeatingMutationResponse>(`/admin/seating/assignments/${guestId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ table_id: tableId }),
  });
}

export function unassignAdministratorParty(
  accessToken: string,
  guestId: number,
): Promise<SeatingMutationResponse> {
  return apiRequest<SeatingMutationResponse>(`/admin/seating/assignments/${guestId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
