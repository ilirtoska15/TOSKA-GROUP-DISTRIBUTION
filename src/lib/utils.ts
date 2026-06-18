import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm')
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00 €'
  return `${amount.toFixed(2)} €`
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0'
  return n.toLocaleString('de-DE')
}

// Reference number generators
export async function generateReference(
  db: import('@prisma/client').PrismaClient,
  type: 'customer' | 'product' | 'order' | 'payment' | 'return' | 'damage' | 'visit'
): Promise<string> {
  const year = new Date().getFullYear()

  const prefixMap: Record<string, string> = {
    customer: 'MK',
    product: 'PR',
    order: 'ORD',
    payment: 'PAY',
    return: 'RET',
    damage: 'DMG',
    visit: 'VIS',
  }

  const prefix = prefixMap[type]

  const counter = await db.sequenceCounter.upsert({
    where: { name_year: { name: type, year } },
    update: { value: { increment: 1 } },
    create: { name: type, year, value: 1 },
  })

  const padded = String(counter.value).padStart(6, '0')

  if (type === 'customer' || type === 'product') {
    return `${prefix}${padded}`
  }

  return `${prefix}-${year}-${padded}`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-700',
    BLOCKED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    PRET_APROVIM: 'bg-yellow-100 text-yellow-800',
    APROVUAR: 'bg-green-100 text-green-800',
    NE_PERGATITJE: 'bg-purple-100 text-purple-800',
    GATI_PER_NGARKIM: 'bg-indigo-100 text-indigo-800',
    NE_DERGESE: 'bg-blue-100 text-blue-800',
    DORËZUAR: 'bg-green-100 text-green-800',
    DESHTUAR: 'bg-red-100 text-red-800',
    ANULUAR: 'bg-red-100 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    NE_PRITJE: 'bg-yellow-100 text-yellow-800',
    MARRE_NGA_SHOFERI: 'bg-blue-100 text-blue-800',
    KTHYER_NE_DEPO: 'bg-purple-100 text-purple-800',
    PERFUNDUAR: 'bg-green-100 text-green-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    LOADED: 'bg-indigo-100 text-indigo-800',
    IN_DELIVERY: 'bg-orange-100 text-orange-800',
    DELIVERED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    OPEN: 'bg-blue-100 text-blue-800',
    CLOSED: 'bg-gray-100 text-gray-700',
    CASH: 'bg-green-100 text-green-800',
    BANK: 'bg-blue-100 text-blue-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Aktiv',
    INACTIVE: 'Joaktiv',
    BLOCKED: 'Bllokuar',
    DRAFT: 'Draft',
    SUBMITTED: 'Dërguar',
    PRET_APROVIM: 'Pret Aprovim',
    APROVUAR: 'Aprovuar',
    NE_PERGATITJE: 'Në Përgatitje',
    GATI_PER_NGARKIM: 'Gati për Ngarkim',
    NE_DERGESE: 'Në Dërgesë',
    DORËZUAR: 'Dorëzuar',
    DESHTUAR: 'Dështuar',
    ANULUAR: 'Anuluar',
    PENDING: 'Në pritje',
    APPROVED: 'Aprovuar',
    REJECTED: 'Refuzuar',
    NE_PRITJE: 'Në Pritje',
    APROVUAR_RET: 'Aprovuar',
    REFUZUAR: 'Refuzuar',
    MARRE_NGA_SHOFERI: 'Marrë nga Shoferi',
    KTHYER_NE_DEPO: 'Kthyer në Depo',
    PERFUNDUAR: 'Përfunduar',
    ASSIGNED: 'Caktuar',
    LOADED: 'Ngarkuar',
    IN_DELIVERY: 'Në Dërgesë',
    DELIVERED: 'Dorëzuar',
    FAILED: 'Dështuar',
    OPEN: 'Hapur',
    CLOSED: 'Mbyllur',
    CASH: 'Kesh',
    BANK: 'Bankë',
    ADMIN: 'Admin',
    AGJENT: 'Agjent',
    SHOFER: 'Shofer',
    DEPOIST: 'Depoist',
    COPE: 'Copë',
    PAKO: 'Pako',
  }
  return map[status] ?? status
}

export function calculateStockFromMovements(movements: Array<{ type: string; quantityCopje: number }>): number {
  let stock = 0
  for (const m of movements) {
    if (['IN', 'RETURN', 'ADJUSTMENT'].includes(m.type)) {
      stock += m.quantityCopje
    } else if (['OUT', 'RESERVATION', 'DAMAGE'].includes(m.type)) {
      stock -= m.quantityCopje
    } else if (m.type === 'RESERVATION_RELEASE') {
      stock += m.quantityCopje
    }
  }
  return stock
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}
