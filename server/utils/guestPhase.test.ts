import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeGuestPhase,
  isSensitiveDataAllowed,
  isAiSilentPhase,
  type BookingForPhase,
} from './guestPhase.js'

// Базовое "сейчас" для детерминированных тестов.
const NOW = new Date('2026-06-10T12:00:00Z')

function booking(partial: Partial<BookingForPhase>): BookingForPhase {
  return {
    checkIn: new Date('2026-06-12T11:00:00Z'),
    checkOut: new Date('2026-06-15T08:00:00Z'),
    accessUnlocked: true,
    prepaidAmount: 5000,
    ...partial,
  }
}

test('нет брони → NO_BOOKING', () => {
  assert.equal(computeGuestPhase(null, NOW), 'NO_BOOKING')
})

test('не оплачено (accessUnlocked=false, prepaid=0) → AWAITING_PAYMENT', () => {
  const b = booking({ accessUnlocked: false, prepaidAmount: 0 })
  assert.equal(computeGuestPhase(b, NOW), 'AWAITING_PAYMENT')
})

test('оплачено через prepaidAmount даже при accessUnlocked=false → не AWAITING_PAYMENT', () => {
  const b = booking({ accessUnlocked: false, prepaidAmount: 3000 })
  assert.notEqual(computeGuestPhase(b, NOW), 'AWAITING_PAYMENT')
})

test('оплачено, заезд через 2 дня → PAID_BEFORE', () => {
  const b = booking({ checkIn: new Date('2026-06-12T11:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'PAID_BEFORE')
})

test('оплачено, до заезда менее 4ч → CHECK_IN_DAY', () => {
  const b = booking({ checkIn: new Date('2026-06-10T14:00:00Z'), checkOut: new Date('2026-06-13T08:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'CHECK_IN_DAY')
})

test('заехал 13ч назад → STAYING', () => {
  const b = booking({ checkIn: new Date('2026-06-09T23:00:00Z'), checkOut: new Date('2026-06-14T08:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'STAYING')
})

test('день выезда (после полуночи дня checkout) → CHECKOUT_DAY', () => {
  // checkout сегодня в 14:00, сейчас 12:00 → уже наступила полночь дня выезда
  const b = booking({ checkIn: new Date('2026-06-07T11:00:00Z'), checkOut: new Date('2026-06-10T14:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'CHECKOUT_DAY')
})

test('выехал 1ч назад → POST_STAY_QUIET', () => {
  const b = booking({ checkIn: new Date('2026-06-07T11:00:00Z'), checkOut: new Date('2026-06-10T11:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'POST_STAY_QUIET')
})

test('выехал 3 дня назад → POST_STAY_ACTIVE', () => {
  const b = booking({ checkIn: new Date('2026-06-04T11:00:00Z'), checkOut: new Date('2026-06-07T11:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'POST_STAY_ACTIVE')
})

test('выехал 10 дней назад → POST_STAY_OLD', () => {
  const b = booking({ checkIn: new Date('2026-05-28T11:00:00Z'), checkOut: new Date('2026-05-31T11:00:00Z') })
  assert.equal(computeGuestPhase(b, NOW), 'POST_STAY_OLD')
})

test('isSensitiveDataAllowed: разрешено только в check-in/staying/checkout', () => {
  assert.equal(isSensitiveDataAllowed('CHECK_IN_DAY'), true)
  assert.equal(isSensitiveDataAllowed('STAYING'), true)
  assert.equal(isSensitiveDataAllowed('CHECKOUT_DAY'), true)
  assert.equal(isSensitiveDataAllowed('AWAITING_PAYMENT'), false)
  assert.equal(isSensitiveDataAllowed('PAID_BEFORE'), false)
  assert.equal(isSensitiveDataAllowed('POST_STAY_ACTIVE'), false)
  assert.equal(isSensitiveDataAllowed('NO_BOOKING'), false)
})

test('isAiSilentPhase: молчим только в post-stay quiet/old', () => {
  assert.equal(isAiSilentPhase('POST_STAY_QUIET'), true)
  assert.equal(isAiSilentPhase('POST_STAY_OLD'), true)
  assert.equal(isAiSilentPhase('STAYING'), false)
  assert.equal(isAiSilentPhase('NO_BOOKING'), false)
})
