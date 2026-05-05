export const roleRoutes = {
  owner: "/admin",
  miner: "/dashboard/mining",
  certification: "/dashboard/government",
  transporter: "/dashboard/transport",
  industry: "/dashboard/industry",
  smartgrid: "/dashboard/smart-grid",
} as const;

export type RoleKey = keyof typeof roleRoutes;

export function getRoleLabel(role: RoleKey): string {
  if (role === "smartgrid") return "Smart Grid";
  if (role === "certification") return "Certification Authority";
  if (role === "owner") return "Owner / Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}


