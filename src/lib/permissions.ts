export type Permission =
  | 'collect_payments'
  | 'approve_orders'
  | 'approve_returns'
  | 'manage_stock'
  | 'view_reports'
  | 'manage_users'
  | 'manage_config'
  | 'export_data'
  | 'import_data'
  | 'force_logout'
  | 'manage_expenses'
  | 'manage_targets'

export const ALL_PERMISSIONS: Permission[] = [
  'collect_payments',
  'approve_orders',
  'approve_returns',
  'manage_stock',
  'view_reports',
  'manage_users',
  'manage_config',
  'export_data',
  'import_data',
  'force_logout',
  'manage_expenses',
  'manage_targets',
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  collect_payments: 'Mbledh Pagesa',
  approve_orders: 'Aprovo Porosi',
  approve_returns: 'Aprovo Kthime',
  manage_stock: 'Menaxho Stok',
  view_reports: 'Shih Raporte',
  manage_users: 'Menaxho Përdorues',
  manage_config: 'Konfiguro Sistemin',
  export_data: 'Eksporto të Dhëna',
  import_data: 'Importo të Dhëna',
  force_logout: 'Dil Dhunshëm Përdoruesit',
  manage_expenses: 'Menaxho Shpenzime',
  manage_targets: 'Menaxho Targete',
}

// Default permissions by role
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  AGJENT: [],
  SHOFER: [],
  DEPOIST: ['manage_stock'],
}

export function hasPermission(
  userRole: string,
  userPermissions: Array<{ permission: string; enabled: boolean }>,
  permission: Permission
): boolean {
  if (userRole === 'ADMIN') return true

  const override = userPermissions.find((p) => p.permission === permission)
  if (override) return override.enabled

  return ROLE_DEFAULT_PERMISSIONS[userRole]?.includes(permission) ?? false
}
