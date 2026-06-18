import webpush from 'web-push'
import { db } from './db'

let pushConfigured = false

function ensurePushConfigured(): boolean {
  if (pushConfigured) return true

  const email = process.env.VAPID_EMAIL
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!email || !publicKey || !privateKey) {
    console.warn('[push] VAPID keys not set — push notifications disabled')
    return false
  }

  try {
    webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey)
    pushConfigured = true
    return true
  } catch (err) {
    console.warn('[push] Failed to configure VAPID:', err)
    return false
  }
}

export async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
  if (!ensurePushConfigured()) return

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
        if (
          typeof err === 'object' && err !== null && 'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => null)
        }
      }
    }),
  )
}

export async function sendPushToRole(role: string, title: string, body: string, url?: string) {
  if (!ensurePushConfigured()) return

  const users = await db.user.findMany({
    where: { role: role as never, status: 'ACTIVE' },
    select: { id: true },
  })
  await Promise.allSettled(users.map(u => sendPushToUser(u.id, title, body, url)))
}
