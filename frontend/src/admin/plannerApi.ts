import { apiRequest } from "../lib/api";
import type { PlannerDocument, PlannerResponse } from "./plannerTypes";

export const loadPlanner = (token: string) =>
  apiRequest<PlannerResponse>("/admin/planner", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
export const savePlanner = (
  token: string,
  revision: number,
  document: PlannerDocument,
) =>
  apiRequest<PlannerResponse>("/admin/planner", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ revision, document }),
  });
