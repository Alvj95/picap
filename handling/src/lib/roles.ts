export const ROLES = ['Check-in', 'Embarque', 'Rampa', 'Llegadas', 'Equipajes', 'Operaciones', 'PMR', 'Supervisión']

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777', '#4b5563']

/** Stable color per role so the calendar reads at a glance. */
export function roleColor(role: string): string {
  const known = ROLES.findIndex((r) => r.toLowerCase() === role.trim().toLowerCase())
  if (known >= 0) return PALETTE[known]
  let h = 0
  for (const ch of role) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return role ? PALETTE[h % PALETTE.length] : PALETTE[0]
}
