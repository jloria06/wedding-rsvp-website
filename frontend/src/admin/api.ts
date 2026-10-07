import { apiRequest } from "../lib/api";
import type {
  AdminLoginResponse,
  AdminProfile,
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
