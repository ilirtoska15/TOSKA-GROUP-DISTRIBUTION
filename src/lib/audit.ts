import { db } from '@/lib/db'

interface AuditOptions {
  userId?: string
  module: string
  action: string
  recordId?: string
  prevValue?: unknown
  newValue?: unknown
  ipAddress?: string
}

export async function createAuditLog(opts: AuditOptions) {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId,
        module: opts.module,
        action: opts.action,
        recordId: opts.recordId,
        prevValue: opts.prevValue ? JSON.stringify(opts.prevValue) : undefined,
        newValue: opts.newValue ? JSON.stringify(opts.newValue) : undefined,
        ipAddress: opts.ipAddress,
      },
    })
  } catch {
    // Audit log failure must not block business operations
  }
}

export async function logError(opts: {
  message: string
  module?: string
  userId?: string
  context?: unknown
}) {
  try {
    await db.errorLog.create({
      data: {
        message: opts.message,
        module: opts.module,
        userId: opts.userId,
        context: opts.context ? JSON.stringify(opts.context) : undefined,
      },
    })
  } catch {
    // noop
  }
}
