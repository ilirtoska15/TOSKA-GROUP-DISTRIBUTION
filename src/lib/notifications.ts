import { db } from '@/lib/db'

type NotifDb = typeof db

interface NotificationInput {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}

// Creates a notification but deduplicates against existing unread notifications
// of the same type+link for the same user within the last 24 hours.
export async function createNotificationSafe(
  notifDb: NotifDb,
  input: NotificationInput,
): Promise<void> {
  try {
    if (input.link) {
      const existing = await notifDb.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          link: input.link,
          isRead: false,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      if (existing) return
    }
    await notifDb.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    })
  } catch {
    // Notifications must never crash the main operation
  }
}

// Sends notifications to all active users with the given roles
export async function notifyRoles(
  notifDb: NotifDb,
  roles: string[],
  payload: Omit<NotificationInput, 'userId'>,
): Promise<void> {
  try {
    const users = await notifDb.user.findMany({
      where: { role: { in: roles }, status: 'ACTIVE' },
      select: { id: true },
    })
    await Promise.all(users.map(u =>
      createNotificationSafe(notifDb, { ...payload, userId: u.id }),
    ))
  } catch {
    // Silent
  }
}
