import type { Division, Team } from "@/lib/types";

export const TEAM_LABEL: Record<Team, string> = { MECHANICAL: "Mechanical", ELECTRICAL: "Electrical" };

// "PLSS, admin data" / "Teknikal, Mechanical" / "Teknikal"
export function roleLabel(division: Division | string, team?: Team | null) {
  if (division === "PLSS") return "PLSS, admin data";
  return team ? `Teknikal, ${TEAM_LABEL[team]}` : "Teknikal";
}
