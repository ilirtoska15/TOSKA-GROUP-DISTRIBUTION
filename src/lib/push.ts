import webpush from 'web-push'
import { db } from './db'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@toska.al',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

export async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  const payload = JSON.stringify({ title, body, url: url ?? '/' })

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'statusCode' in err &&
            (err as { statusCode: number }).statusCode === 410) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => null)
        }
      }
    }),
  )
}

export async function sendPushToRole(role: string, title: string, body: string, url?: string) {
  const users = await db.user.findMany({ where: { role: role as never, status: 'ACTIVE' }, select: { id: true } })
  await Promise.allSettled(users.map(u => sendPushToUser(u.id, title, body, url)))
}
