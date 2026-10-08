import { apiRequest } from "../lib/api";
import type {
  AdminLoginResponse,
  AdminProfile,
  DashboardStatistics,
  AdminGuest,
  GuestInput,
  GuestUpdate,
  MessageResponse,
} from "./types";

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
