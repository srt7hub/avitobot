// Фаза гостя — вычисляется из брони и текущего времени. Определяет, что боту
// можно и нельзя говорить (в частности, гейтинг кода двери / wifi).
// Адаптировано из SmartApart под модель Booking SaaS (признак оплаты —
// accessUnlocked || prepaidAmount > 0, явного paymentStatus в схеме нет).

export type GuestPhase =
  | 'NO_BOOKING'
  | 'AWAITING_PAYMENT'
  | 'PAID_BEFORE'
  | 'CHECK_IN_DAY'
  | 'STAYING'
  | 'CHECKOUT_DAY'
  | 'POST_STAY_QUIET'
  | 'POST_STAY_ACTIVE'
  | 'POST_STAY_OLD'

export type BookingForPhase = {
  checkIn: Date | string
  checkOut: Date | string
  accessUnlocked: boolean
  prepaidAmount: number
}

function isPaid(booking: BookingForPhase): boolean {
  return booking.accessUnlocked || booking.prepaidAmount > 0
}

export function computeGuestPhase(booking: BookingForPhase | null, now: Date = new Date()): GuestPhase {
  if (!booking) return 'NO_BOOKING'

  if (!isPaid(booking)) return 'AWAITING_PAYMENT'

  const checkIn = new Date(booking.checkIn)
  const checkOut = new Date(booking.checkOut)

  if (now > checkOut) {
    const hoursAfter = (now.getTime() - checkOut.getTime()) / (1000 * 60 * 60)
    if (hoursAfter < 2) return 'POST_STAY_QUIET'
    if (hoursAfter < 7 * 24) return 'POST_STAY_ACTIVE'
    return 'POST_STAY_OLD'
  }

  // День выезда (с полуночи дня выезда до времени выезда)
  const checkOutMidnight = new Date(checkOut)
  checkOutMidnight.setHours(0, 0, 0, 0)
  if (now >= checkOutMidnight) return 'CHECKOUT_DAY'

  // Гость заехал 12+ часов назад
  const checkIn12h = new Date(checkIn.getTime() + 12 * 60 * 60 * 1000)
  if (now >= checkIn12h) return 'STAYING'

  // День заезда: ≤4ч до checkIn или уже заехал <12ч назад
  const checkInMinus4h = new Date(checkIn.getTime() - 4 * 60 * 60 * 1000)
  if (now >= checkInMinus4h) return 'CHECK_IN_DAY'

  return 'PAID_BEFORE'
}

// Приоритет фаз: при нескольких бронях у гостя берём самую "горячую".
export const PHASE_PRIORITY: Record<GuestPhase, number> = {
  STAYING: 0,
  CHECK_IN_DAY: 1,
  PAID_BEFORE: 2,
  AWAITING_PAYMENT: 3,
  CHECKOUT_DAY: 4,
  POST_STAY_QUIET: 5,
  POST_STAY_ACTIVE: 6,
  POST_STAY_OLD: 7,
  NO_BOOKING: 8,
}

// Тихие фазы: AI не отвечает сам, зовём оператора.
export function isAiSilentPhase(phase: GuestPhase): boolean {
  return phase === 'POST_STAY_QUIET' || phase === 'POST_STAY_OLD'
}

// Можно ли отдавать код двери / wifi / инструкции по заселению.
// Только когда гость оплатил И фактически заезжает/проживает/выезжает.
export function isSensitiveDataAllowed(phase: GuestPhase): boolean {
  return phase === 'CHECK_IN_DAY' || phase === 'STAYING' || phase === 'CHECKOUT_DAY'
}
