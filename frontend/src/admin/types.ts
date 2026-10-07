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
