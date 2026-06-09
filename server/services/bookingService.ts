import prisma from '../prisma.js'
import { computeGuestPhase, PHASE_PRIORITY, type GuestPhase, type BookingForPhase } from '../utils/guestPhase.js'
import type { Booking } from '@prisma/client'

export type BookingWithPhase = { booking: Booking; phase: GuestPhase }

function pickHottest(bookings: Booking[], now: Date): BookingWithPhase | null {
  if (!bookings.length) return null
  const candidates = bookings
    .map(b => ({ booking: b, phase: computeGuestPhase(b as BookingForPhase, now) }))
    .filter(({ phase }) => phase !== 'POST_STAY_OLD')
    .sort((a, b) => PHASE_PRIORITY[a.phase] - PHASE_PRIORITY[b.phase])
  return candidates[0] ?? null
}

/**
 * Находит релевантную бронь для чата и её фазу.
 * Сначала ищем по avitoChatId (надёжно — каждый гость видит только свою бронь),
 * затем fallback по объекту (если бронь ещё не привязана к чату).
 * Возвращает null, если активной брони нет — бот работает в фазе NO_BOOKING.
 */
export async function findBookingForChat(
  tenantId: string,
  avitoChatId: string,
  propertyId: string | undefined,
  now: Date = new Date()
): Promise<BookingWithPhase | null> {
  const byChat = await prisma.booking.findMany({
    where: { tenantId, avitoChatId },
    orderBy: { createdAt: 'desc' },
  })
  const fromChat = pickHottest(byChat, now)
  if (fromChat) return fromChat

  if (!propertyId) return null

  // Fallback: брони объекта в актуальном окне (от -7 дней до +14 дней).
  const pastLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const futureLimit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const byProperty = await prisma.booking.findMany({
    where: {
      tenantId,
      propertyId,
      OR: [
        { checkOut: { gte: pastLimit } },
        { checkIn: { gt: now, lte: futureLimit } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
  return pickHottest(byProperty, now)
}
